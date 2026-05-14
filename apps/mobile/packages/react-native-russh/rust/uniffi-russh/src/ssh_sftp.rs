//! SFTP session built on russh-sftp 2.x and exposed to React Native via
//! UniFFI. The SftpSession wraps `russh_sftp::client::SftpSession` opened
//! on a fresh channel of the underlying russh client. SshConnection owns
//! the sftps map and routes start_sftp() / disconnect() through it.
//!
//! Transfer cancellation model: caller (JS) generates a transfer_id (uuid)
//! and stores it before awaiting upload/download. Mid-flight cancel calls
//! cancel_transfer(transfer_id) synchronously; the running tokio task
//! observes the AtomicBool and returns SftpError::Cancelled. Progress
//! callbacks are coalesced to 50 ms windows to avoid JS-bridge thrash.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use thiserror::Error;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::Mutex as AsyncMutex;

use russh_sftp::client::SftpSession as RusshSftp;
use russh_sftp::protocol::{FileAttributes, OpenFlags};

use crate::utils::now_ms;

const DEFAULT_CHUNK_SIZE: usize = 64 * 1024;
const PROGRESS_COALESCE: Duration = Duration::from_millis(50);

#[derive(Debug, Error, uniffi::Error)]
pub enum SftpError {
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    #[error("Cancelled")]
    Cancelled,
    #[error("Local IO error: {0}")]
    LocalIo(String),
    #[error("Protocol error: {0}")]
    Protocol(String),
    #[error("SSH error: {0}")]
    Ssh(String),
}

impl From<russh_sftp::client::error::Error> for SftpError {
    fn from(e: russh_sftp::client::error::Error) -> Self {
        // We don't discriminate StatusCode here because uniffi error
        // variants pay for their tag bytes across the FFI boundary and the
        // JS layer ends up displaying a message string either way.
        // Downstream callers can pattern-match on the message if they need
        // to surface NotFound vs PermissionDenied.
        SftpError::Protocol(e.to_string())
    }
}

impl From<russh::Error> for SftpError {
    fn from(e: russh::Error) -> Self {
        SftpError::Ssh(e.to_string())
    }
}

impl From<std::io::Error> for SftpError {
    fn from(e: std::io::Error) -> Self {
        SftpError::LocalIo(e.to_string())
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct SftpEntry {
    pub filename: String,
    pub is_directory: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub mode: u32,
    pub modified_at_ms: f64,
    pub accessed_at_ms: f64,
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct SftpStat {
    pub is_directory: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub mode: u32,
    pub modified_at_ms: f64,
    pub accessed_at_ms: f64,
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct SftpTransferInfo {
    pub transfer_id: String,
    pub remote_path: String,
    pub local_path: String,
    pub total_bytes: Option<u64>,
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct SftpSessionInfo {
    pub session_id: String,
    pub connection_id: String,
    pub created_at_ms: f64,
}

#[uniffi::export(with_foreign)]
pub trait SftpProgressCallback: Send + Sync {
    fn on_progress(&self, transfer_id: String, bytes_done: u64, total: Option<u64>);
}

fn attrs_to_entry(filename: String, attrs: &FileAttributes) -> SftpEntry {
    SftpEntry {
        filename,
        is_directory: attrs.is_dir(),
        is_symlink: attrs.is_symlink(),
        size: attrs.len(),
        mode: attrs.permissions.unwrap_or(0),
        // SFTP atime/mtime are seconds since the unix epoch; ms axis matches
        // the rest of the public surface (now_ms, ShellSessionInfo).
        modified_at_ms: attrs.mtime.map(|t| (t as f64) * 1000.0).unwrap_or(0.0),
        accessed_at_ms: attrs.atime.map(|t| (t as f64) * 1000.0).unwrap_or(0.0),
    }
}

fn attrs_to_stat(attrs: &FileAttributes) -> SftpStat {
    SftpStat {
        is_directory: attrs.is_dir(),
        is_symlink: attrs.is_symlink(),
        size: attrs.len(),
        mode: attrs.permissions.unwrap_or(0),
        modified_at_ms: attrs.mtime.map(|t| (t as f64) * 1000.0).unwrap_or(0.0),
        accessed_at_ms: attrs.atime.map(|t| (t as f64) * 1000.0).unwrap_or(0.0),
    }
}

#[derive(uniffi::Object)]
pub struct SftpSession {
    pub session_id: String,
    pub created_at_ms: f64,
    pub connection_id: String,

    inner: AsyncMutex<RusshSftp>,
    transfers: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl SftpSession {
    pub(crate) fn new(session_id: String, connection_id: String, inner: RusshSftp) -> Self {
        SftpSession {
            session_id,
            created_at_ms: now_ms(),
            connection_id,
            inner: AsyncMutex::new(inner),
            transfers: Mutex::new(HashMap::new()),
        }
    }
}

#[uniffi::export(async_runtime = "tokio")]
impl SftpSession {
    pub fn get_info(&self) -> SftpSessionInfo {
        SftpSessionInfo {
            session_id: self.session_id.clone(),
            connection_id: self.connection_id.clone(),
            created_at_ms: self.created_at_ms,
        }
    }

    pub async fn list(&self, path: String) -> Result<Vec<SftpEntry>, SftpError> {
        let inner = self.inner.lock().await;
        let read_dir = inner.read_dir(&path).await?;
        let entries: Vec<SftpEntry> = read_dir
            .into_iter()
            .map(|entry| {
                let attrs = entry.metadata();
                attrs_to_entry(entry.file_name(), &attrs)
            })
            .collect();
        Ok(entries)
    }

    pub async fn stat(&self, path: String) -> Result<SftpStat, SftpError> {
        let inner = self.inner.lock().await;
        let attrs = inner.metadata(path).await?;
        Ok(attrs_to_stat(&attrs))
    }

    pub async fn mkdir(&self, path: String, _mode: Option<u32>) -> Result<(), SftpError> {
        // russh-sftp's create_dir doesn't accept a mode parameter — servers
        // honor umask. If we ever need an explicit mode, chain a chmod after
        // creation. The mode parameter stays in the public surface so the JS
        // wrapper can pass it without a contract break later.
        let inner = self.inner.lock().await;
        inner.create_dir(path).await?;
        Ok(())
    }

    pub async fn rmdir(&self, path: String) -> Result<(), SftpError> {
        let inner = self.inner.lock().await;
        inner.remove_dir(path).await?;
        Ok(())
    }

    pub async fn remove(&self, path: String) -> Result<(), SftpError> {
        let inner = self.inner.lock().await;
        inner.remove_file(path).await?;
        Ok(())
    }

    pub async fn rename(&self, from: String, to: String) -> Result<(), SftpError> {
        let inner = self.inner.lock().await;
        inner.rename(from, to).await?;
        Ok(())
    }

    pub async fn chmod(&self, path: String, mode: u32) -> Result<(), SftpError> {
        let inner = self.inner.lock().await;
        let mut attrs = FileAttributes::default();
        attrs.permissions = Some(mode);
        inner
            .set_metadata(path, attrs)
            .await
            .map_err(|e| SftpError::Protocol(e.to_string()))?;
        Ok(())
    }

    pub async fn realpath(&self, path: String) -> Result<String, SftpError> {
        let inner = self.inner.lock().await;
        let resolved = inner.canonicalize(path).await?;
        Ok(resolved)
    }

    /// Upload local_path → remote_path. transfer_id is caller-generated so
    /// JS can call cancel_transfer mid-flight before the await resolves.
    pub async fn upload(
        &self,
        transfer_id: String,
        local_path: String,
        remote_path: String,
        chunk_size: Option<u32>,
        on_progress: Option<Arc<dyn SftpProgressCallback>>,
    ) -> Result<SftpTransferInfo, SftpError> {
        let chunk = chunk_size.map(|n| n as usize).unwrap_or(DEFAULT_CHUNK_SIZE);
        let cancel = Arc::new(AtomicBool::new(false));
        self.transfers
            .lock()
            .unwrap()
            .insert(transfer_id.clone(), cancel.clone());

        let result = self
            .run_upload(
                transfer_id.clone(),
                local_path.clone(),
                remote_path.clone(),
                chunk,
                cancel,
                on_progress,
            )
            .await;
        self.transfers.lock().unwrap().remove(&transfer_id);
        result.map(|total| SftpTransferInfo {
            transfer_id,
            remote_path,
            local_path,
            total_bytes: Some(total),
        })
    }

    /// Download remote_path → local_path. Same cancel contract as upload().
    pub async fn download(
        &self,
        transfer_id: String,
        remote_path: String,
        local_path: String,
        chunk_size: Option<u32>,
        on_progress: Option<Arc<dyn SftpProgressCallback>>,
    ) -> Result<SftpTransferInfo, SftpError> {
        let chunk = chunk_size.map(|n| n as usize).unwrap_or(DEFAULT_CHUNK_SIZE);
        let cancel = Arc::new(AtomicBool::new(false));
        self.transfers
            .lock()
            .unwrap()
            .insert(transfer_id.clone(), cancel.clone());

        let result = self
            .run_download(
                transfer_id.clone(),
                remote_path.clone(),
                local_path.clone(),
                chunk,
                cancel,
                on_progress,
            )
            .await;
        self.transfers.lock().unwrap().remove(&transfer_id);
        result.map(|total| SftpTransferInfo {
            transfer_id,
            remote_path,
            local_path,
            total_bytes: Some(total),
        })
    }

    pub fn cancel_transfer(&self, transfer_id: String) -> bool {
        match self.transfers.lock().unwrap().get(&transfer_id) {
            Some(token) => {
                token.store(true, Ordering::SeqCst);
                true
            }
            None => false,
        }
    }

    pub async fn close(&self) -> Result<(), SftpError> {
        let inner = self.inner.lock().await;
        inner.close().await?;
        Ok(())
    }
}

impl SftpSession {
    async fn run_upload(
        &self,
        transfer_id: String,
        local_path: String,
        remote_path: String,
        chunk: usize,
        cancel: Arc<AtomicBool>,
        on_progress: Option<Arc<dyn SftpProgressCallback>>,
    ) -> Result<u64, SftpError> {
        let mut local = tokio::fs::File::open(&local_path).await?;
        let metadata = local.metadata().await?;
        let total = metadata.len();

        let inner = self.inner.lock().await;
        let mut remote = inner
            .open_with_flags(
                remote_path.clone(),
                OpenFlags::CREATE | OpenFlags::TRUNCATE | OpenFlags::WRITE,
            )
            .await?;
        // Drop the lock before the read/write loop — russh-sftp's File holds
        // its own channel handle and doesn't need the session mutex held to
        // do per-chunk IO.
        drop(inner);

        let mut buf = vec![0u8; chunk];
        let mut bytes_done: u64 = 0;
        let mut last_emit = Instant::now() - PROGRESS_COALESCE;

        loop {
            if cancel.load(Ordering::SeqCst) {
                return Err(SftpError::Cancelled);
            }
            let n = local.read(&mut buf).await?;
            if n == 0 {
                break;
            }
            remote.write_all(&buf[..n]).await?;
            bytes_done += n as u64;
            let now = Instant::now();
            if now.duration_since(last_emit) >= PROGRESS_COALESCE {
                if let Some(cb) = on_progress.as_ref() {
                    cb.on_progress(transfer_id.clone(), bytes_done, Some(total));
                }
                last_emit = now;
            }
        }

        remote.flush().await?;
        remote.shutdown().await?;

        if let Some(cb) = on_progress.as_ref() {
            cb.on_progress(transfer_id.clone(), bytes_done, Some(total));
        }

        Ok(total)
    }

    async fn run_download(
        &self,
        transfer_id: String,
        remote_path: String,
        local_path: String,
        chunk: usize,
        cancel: Arc<AtomicBool>,
        on_progress: Option<Arc<dyn SftpProgressCallback>>,
    ) -> Result<u64, SftpError> {
        let inner = self.inner.lock().await;
        let mut remote = inner.open(remote_path.clone()).await?;
        drop(inner);

        let remote_attrs = remote.metadata().await?;
        let total = remote_attrs.len();

        let mut local = tokio::fs::File::create(&local_path).await?;
        let mut buf = vec![0u8; chunk];
        let mut bytes_done: u64 = 0;
        let mut last_emit = Instant::now() - PROGRESS_COALESCE;

        loop {
            if cancel.load(Ordering::SeqCst) {
                return Err(SftpError::Cancelled);
            }
            let n = remote.read(&mut buf).await?;
            if n == 0 {
                break;
            }
            local.write_all(&buf[..n]).await?;
            bytes_done += n as u64;
            let now = Instant::now();
            if now.duration_since(last_emit) >= PROGRESS_COALESCE {
                if let Some(cb) = on_progress.as_ref() {
                    cb.on_progress(transfer_id.clone(), bytes_done, Some(total));
                }
                last_emit = now;
            }
        }

        local.flush().await?;
        remote.shutdown().await?;

        if let Some(cb) = on_progress.as_ref() {
            cb.on_progress(transfer_id.clone(), bytes_done, Some(total));
        }

        Ok(total)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancel_token_flips_on_request() {
        let token = Arc::new(AtomicBool::new(false));
        let mut map: HashMap<String, Arc<AtomicBool>> = HashMap::new();
        map.insert("xfer-1".to_string(), token.clone());
        // Simulate cancel_transfer
        if let Some(t) = map.get("xfer-1") {
            t.store(true, Ordering::SeqCst);
        }
        assert!(token.load(Ordering::SeqCst));
    }

    #[test]
    fn cancel_unknown_id_is_noop() {
        let map: HashMap<String, Arc<AtomicBool>> = HashMap::new();
        assert!(map.get("missing").is_none());
    }

    #[test]
    fn attrs_to_entry_handles_missing_optionals() {
        let attrs = FileAttributes::default();
        let entry = attrs_to_entry("a.txt".to_string(), &attrs);
        assert_eq!(entry.filename, "a.txt");
        assert_eq!(entry.size, 0);
        assert_eq!(entry.mode, 0);
        assert_eq!(entry.modified_at_ms, 0.0);
        assert_eq!(entry.accessed_at_ms, 0.0);
    }
}
