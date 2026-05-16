use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

pub(crate) fn now_ms() -> f64 {
    let d = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    d.as_millis() as f64
}

// russh spawns its session task through russh-util's runtime wrapper which
// reduces any panic (or cancellation) on that task to an info-less
// `JoinError` placeholder. We capture panic payloads through a process-wide
// hook so `From<russh::Error>` can substitute the actual reason when the
// `Join` variant surfaces.
static LAST_PANIC: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn last_panic_slot() -> &'static Mutex<Option<String>> {
    LAST_PANIC.get_or_init(|| Mutex::new(None))
}

pub(crate) fn install_panic_hook_once() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let prev = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            let payload = info
                .payload()
                .downcast_ref::<&str>()
                .map(|s| (*s).to_string())
                .or_else(|| info.payload().downcast_ref::<String>().cloned())
                .unwrap_or_else(|| "<non-string panic payload>".to_string());
            let location = info
                .location()
                .map(|l| format!(" at {}:{}", l.file(), l.line()))
                .unwrap_or_default();
            if let Ok(mut slot) = last_panic_slot().lock() {
                *slot = Some(format!("{payload}{location}"));
            }
            prev(info);
        }));
    });
}

pub(crate) fn clear_last_panic() {
    if let Ok(mut slot) = last_panic_slot().lock() {
        *slot = None;
    }
}

fn take_last_panic() -> Option<String> {
    last_panic_slot().lock().ok().and_then(|mut s| s.take())
}

// TODO: Split this into different errors for each public function
#[derive(Debug, Error, uniffi::Error)]
pub enum SshError {
    #[error("Disconnected")]
    Disconnected,
    #[error("Unsupported key type")]
    UnsupportedKeyType,
    #[error("Auth failed: {0}")]
    Auth(String),
    #[error("Shell already running")]
    ShellAlreadyRunning,
    #[error("russh error: {0}")]
    Russh(String),
    #[error("russh-keys error: {0}")]
    RusshKeys(String),
}
impl From<russh::Error> for SshError {
    fn from(e: russh::Error) -> Self {
        if matches!(e, russh::Error::Join(_)) {
            if let Some(p) = take_last_panic() {
                return SshError::Russh(format!("background task panicked: {p}"));
            }
        }
        SshError::Russh(e.to_string())
    }
}
impl From<russh_keys::Error> for SshError {
    fn from(e: russh_keys::Error) -> Self {
        SshError::RusshKeys(e.to_string())
    }
}
impl From<russh_keys::ssh_key::Error> for SshError {
    fn from(e: russh_keys::ssh_key::Error) -> Self {
        SshError::RusshKeys(e.to_string())
    }
}
impl From<russh::keys::ssh_key::Error> for SshError {
    fn from(e: russh::keys::ssh_key::Error) -> Self {
        SshError::RusshKeys(e.to_string())
    }
}
impl From<std::io::Error> for SshError {
    fn from(e: std::io::Error) -> Self {
        SshError::Russh(e.to_string())
    }
}
impl From<russh::client::AuthResult> for SshError {
    fn from(a: russh::client::AuthResult) -> Self {
        SshError::Auth(format!("{a:?}"))
    }
}
