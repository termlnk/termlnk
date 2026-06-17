// Port forwarding tunnels (Local -L / Remote -R / Dynamic -D).
//
// All data piping happens in Rust (tokio tasks) — the TS layer only issues
// start/stop commands and receives status callbacks, so there is zero
// JS↔Native bridge overhead on the hot path.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use russh::Channel;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex as AsyncMutex;
use tokio::task::JoinHandle;

use crate::ssh_connection::{ForwardedTcpipInfo, SshConnection};
use crate::utils::SshError;

// ---------------------------------------------------------------------------
// UniFFI-exported types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, uniffi::Record)]
pub struct LocalForwardConfig {
    pub bind_address: String,
    pub bind_port: u16,
    pub destination_address: String,
    pub destination_port: u16,
}

#[derive(Debug, Clone, PartialEq, uniffi::Record)]
pub struct RemoteForwardConfig {
    pub bind_address: String,
    pub bind_port: u16,
    pub destination_address: String,
    pub destination_port: u16,
}

#[derive(Debug, Clone, PartialEq, uniffi::Record)]
pub struct DynamicForwardConfig {
    pub bind_address: String,
    pub bind_port: u16,
}

#[derive(Debug, Clone, PartialEq, uniffi::Enum)]
pub enum ForwardTunnelStatus {
    Starting,
    Active { effective_bind_port: u16 },
    Failed { error: String },
    Stopped,
}

#[derive(Debug, Clone, PartialEq, uniffi::Record)]
pub struct ForwardTunnelStats {
    pub status: ForwardTunnelStatus,
    pub active_connections: u32,
    pub total_connections: u64,
    pub bytes_in: u64,
    pub bytes_out: u64,
}

#[uniffi::export(with_foreign)]
pub trait ForwardTunnelCallback: Send + Sync {
    fn on_status_change(&self, status: ForwardTunnelStatus);
    fn on_stats_update(&self, stats: ForwardTunnelStats);
}

// ---------------------------------------------------------------------------
// ForwardHandle — opaque tunnel handle returned to TS
// ---------------------------------------------------------------------------

#[derive(uniffi::Object)]
pub struct ForwardHandle {
    status: Mutex<ForwardTunnelStatus>,
    active_connections: AtomicU32,
    total_connections: AtomicU64,
    bytes_in: Arc<AtomicU64>,
    bytes_out: Arc<AtomicU64>,
    cancel: tokio::sync::watch::Sender<bool>,
    accept_task: AsyncMutex<Option<JoinHandle<()>>>,
    pipe_tasks: AsyncMutex<HashMap<u64, JoinHandle<()>>>,
    next_pipe_id: AtomicU64,
    callback: Arc<dyn ForwardTunnelCallback>,
}

#[uniffi::export(async_runtime = "tokio")]
impl ForwardHandle {
    pub async fn stop(&self) -> Result<(), SshError> {
        let _ = self.cancel.send(true);
        if let Some(task) = self.accept_task.lock().await.take() {
            task.abort();
            let _ = task.await;
        }
        let mut tasks = self.pipe_tasks.lock().await;
        for (_, task) in tasks.drain() {
            task.abort();
            let _ = task.await;
        }
        *self.status.lock().unwrap() = ForwardTunnelStatus::Stopped;
        self.callback
            .on_status_change(ForwardTunnelStatus::Stopped);
        Ok(())
    }

    pub fn get_stats(&self) -> ForwardTunnelStats {
        let status = self.status.lock().unwrap().clone();
        ForwardTunnelStats {
            status,
            active_connections: self.active_connections.load(Ordering::Relaxed),
            total_connections: self.total_connections.load(Ordering::Relaxed),
            bytes_in: self.bytes_in.load(Ordering::Relaxed),
            bytes_out: self.bytes_out.load(Ordering::Relaxed),
        }
    }
}

impl ForwardHandle {
    fn new(callback: Arc<dyn ForwardTunnelCallback>) -> Arc<Self> {
        let (cancel_tx, _) = tokio::sync::watch::channel(false);
        Arc::new(Self {
            status: Mutex::new(ForwardTunnelStatus::Starting),
            active_connections: AtomicU32::new(0),
            total_connections: AtomicU64::new(0),
            bytes_in: Arc::new(AtomicU64::new(0)),
            bytes_out: Arc::new(AtomicU64::new(0)),
            cancel: cancel_tx,
            accept_task: AsyncMutex::new(None),
            pipe_tasks: AsyncMutex::new(HashMap::new()),
            next_pipe_id: AtomicU64::new(1),
            callback,
        })
    }

    fn set_status(&self, status: ForwardTunnelStatus) {
        *self.status.lock().unwrap() = status.clone();
        self.callback.on_status_change(status);
    }

    fn inc_active(&self) {
        self.active_connections.fetch_add(1, Ordering::Relaxed);
        self.total_connections.fetch_add(1, Ordering::Relaxed);
    }

    fn dec_active(&self) {
        self.active_connections.fetch_sub(1, Ordering::Relaxed);
    }
}

// ---------------------------------------------------------------------------
// SshConnection methods — Local / Remote / Dynamic forward entry points
// ---------------------------------------------------------------------------

#[uniffi::export(async_runtime = "tokio")]
impl SshConnection {
    pub async fn start_local_forward(
        self: Arc<Self>,
        config: LocalForwardConfig,
        callback: Arc<dyn ForwardTunnelCallback>,
    ) -> Result<Arc<ForwardHandle>, SshError> {
        let handle = ForwardHandle::new(callback);
        let addr: SocketAddr = format!("{}:{}", config.bind_address, config.bind_port)
            .parse()
            .map_err(|e| SshError::Russh(format!("invalid bind address: {e}")))?;
        let listener = TcpListener::bind(addr)
            .await
            .map_err(|e| SshError::Russh(format!("bind failed: {e}")))?;
        let effective_port = listener
            .local_addr()
            .map(|a| a.port())
            .unwrap_or(config.bind_port);

        handle.set_status(ForwardTunnelStatus::Active {
            effective_bind_port: effective_port,
        });

        let h = handle.clone();
        let conn = self.clone();
        let mut cancel_rx = handle.cancel.subscribe();
        let accept_task = tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = cancel_rx.changed() => break,
                    result = listener.accept() => {
                        match result {
                            Ok((client_stream, _)) => {
                                let h2 = h.clone();
                                let conn2 = conn.clone();
                                let dest_addr = config.destination_address.clone();
                                let dest_port = config.destination_port;
                                let bind_addr = config.bind_address.clone();
                                let bind_port = effective_port;
                                let pipe_id = h.next_pipe_id.fetch_add(1, Ordering::Relaxed);
                                let pipe_task = tokio::spawn(async move {
                                    h2.inc_active();
                                    let ch = conn2
                                        .client_handle
                                        .lock()
                                        .await
                                        .channel_open_direct_tcpip(
                                            &dest_addr, dest_port as u32,
                                            &bind_addr, bind_port as u32,
                                        )
                                        .await;
                                    match ch {
                                        Ok(channel) => {
                                            if let Err(e) = pipe_channel_to_stream(channel, client_stream, &h2).await {
                                                eprintln!("[port_forward] pipe error: {e}");
                                            }
                                        }
                                        Err(e) => eprintln!("[port_forward] channel open: {e}"),
                                    }
                                    h2.dec_active();
                                });
                                h.pipe_tasks.lock().await.insert(pipe_id, pipe_task);
                            }
                            Err(e) => {
                                eprintln!("[port_forward] accept error: {e}");
                                break;
                            }
                        }
                    }
                }
            }
        });
        *handle.accept_task.lock().await = Some(accept_task);
        self.forwards.lock().await.push(handle.clone());
        Ok(handle)
    }

    pub async fn start_remote_forward(
        self: Arc<Self>,
        config: RemoteForwardConfig,
        callback: Arc<dyn ForwardTunnelCallback>,
    ) -> Result<Arc<ForwardHandle>, SshError> {
        let handle = ForwardHandle::new(callback);

        let ch = self.client_handle.lock().await;
        let granted_port = ch
            .tcpip_forward(&config.bind_address, config.bind_port as u32)
            .await
            .map_err(|e| SshError::Russh(format!("tcpip_forward failed: {e}")))?;
        let effective_port = if config.bind_port == 0 {
            granted_port as u16
        } else {
            config.bind_port
        };
        drop(ch);

        handle.set_status(ForwardTunnelStatus::Active {
            effective_bind_port: effective_port,
        });

        let (route_tx, mut route_rx) =
            tokio::sync::mpsc::unbounded_channel::<ForwardedTcpipInfo>();
        self.forwarded_routes
            .lock()
            .unwrap()
            .insert(effective_port as u32, route_tx);

        let h = handle.clone();
        let conn = self.clone();
        let dest_addr = config.destination_address.clone();
        let dest_port = config.destination_port;
        let mut cancel_rx = handle.cancel.subscribe();
        let route_port = effective_port as u32;

        let accept_task = tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = cancel_rx.changed() => break,
                    result = route_rx.recv() => {
                        match result {
                            Some(fwd) => {
                                let h2 = h.clone();
                                let da = dest_addr.clone();
                                let dp = dest_port;
                                let pipe_id = h.next_pipe_id.fetch_add(1, Ordering::Relaxed);
                                let pipe_task = tokio::spawn(async move {
                                    h2.inc_active();
                                    match TcpStream::connect(format!("{}:{}", da, dp)).await {
                                        Ok(local_stream) => {
                                            if let Err(e) = pipe_channel_to_stream(fwd.channel, local_stream, &h2).await {
                                                eprintln!("[port_forward/remote] pipe error: {e}");
                                            }
                                        }
                                        Err(e) => eprintln!("[port_forward/remote] local connect: {e}"),
                                    }
                                    h2.dec_active();
                                });
                                h.pipe_tasks.lock().await.insert(pipe_id, pipe_task);
                            }
                            None => break,
                        }
                    }
                }
            }
            conn.forwarded_routes.lock().unwrap().remove(&route_port);
        });
        *handle.accept_task.lock().await = Some(accept_task);
        self.forwards.lock().await.push(handle.clone());
        Ok(handle)
    }

    pub async fn start_dynamic_forward(
        self: Arc<Self>,
        config: DynamicForwardConfig,
        callback: Arc<dyn ForwardTunnelCallback>,
    ) -> Result<Arc<ForwardHandle>, SshError> {
        let handle = ForwardHandle::new(callback);
        let addr: SocketAddr = format!("{}:{}", config.bind_address, config.bind_port)
            .parse()
            .map_err(|e| SshError::Russh(format!("invalid bind address: {e}")))?;
        let listener = TcpListener::bind(addr)
            .await
            .map_err(|e| SshError::Russh(format!("bind failed: {e}")))?;
        let effective_port = listener
            .local_addr()
            .map(|a| a.port())
            .unwrap_or(config.bind_port);

        handle.set_status(ForwardTunnelStatus::Active {
            effective_bind_port: effective_port,
        });

        let h = handle.clone();
        let conn = self.clone();
        let mut cancel_rx = handle.cancel.subscribe();
        let accept_task = tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = cancel_rx.changed() => break,
                    result = listener.accept() => {
                        match result {
                            Ok((client_stream, _)) => {
                                let h2 = h.clone();
                                let conn2 = conn.clone();
                                let pipe_id = h.next_pipe_id.fetch_add(1, Ordering::Relaxed);
                                let pipe_task = tokio::spawn(async move {
                                    h2.inc_active();
                                    if let Err(e) = handle_socks5_connection(&conn2, client_stream, &h2).await {
                                        eprintln!("[port_forward/socks5] pipe error: {e}");
                                    }
                                    h2.dec_active();
                                });
                                h.pipe_tasks.lock().await.insert(pipe_id, pipe_task);
                            }
                            Err(e) => {
                                eprintln!("[port_forward/socks5] accept error: {e}");
                                break;
                            }
                        }
                    }
                }
            }
        });
        *handle.accept_task.lock().await = Some(accept_task);
        self.forwards.lock().await.push(handle.clone());
        Ok(handle)
    }
}

// ---------------------------------------------------------------------------
// Generic bidirectional pipe: SSH channel ↔ TCP stream
// ---------------------------------------------------------------------------

async fn pipe_channel_to_stream(
    ch: Channel<russh::client::Msg>,
    client: TcpStream,
    handle: &ForwardHandle,
) -> Result<(), SshError> {
    let (mut ch_reader, ch_writer) = ch.split();
    let ch_writer = Arc::new(AsyncMutex::new(ch_writer));
    let (mut client_reader, mut client_writer) = client.into_split();

    let bytes_out = handle.bytes_out.clone();
    let w = ch_writer.clone();
    let upload = tokio::spawn(async move {
        let mut buf = vec![0u8; 32768];
        loop {
            match client_reader.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    bytes_out.fetch_add(n as u64, Ordering::Relaxed);
                    let writer = w.lock().await;
                    if writer.data(&buf[..n]).await.is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    let bytes_in = handle.bytes_in.clone();
    let download = tokio::spawn(async move {
        loop {
            match ch_reader.wait().await {
                Some(russh::ChannelMsg::Data { data }) => {
                    bytes_in.fetch_add(data.len() as u64, Ordering::Relaxed);
                    if client_writer.write_all(&data).await.is_err() {
                        break;
                    }
                }
                Some(russh::ChannelMsg::Eof | russh::ChannelMsg::Close) | None => break,
                _ => {}
            }
        }
    });

    let _ = tokio::join!(upload, download);
    let _ = ch_writer.lock().await.close().await;
    Ok(())
}

// ---------------------------------------------------------------------------
// SOCKS5 handler (RFC 1928, no-auth only)
// ---------------------------------------------------------------------------

async fn handle_socks5_connection(
    conn: &SshConnection,
    mut stream: TcpStream,
    handle: &ForwardHandle,
) -> Result<(), SshError> {
    let mut buf = [0u8; 258];

    // 1. Greeting
    stream.read_exact(&mut buf[..2]).await
        .map_err(|e| SshError::Russh(format!("socks5 greeting: {e}")))?;
    if buf[0] != 0x05 {
        return Err(SshError::Russh("not SOCKS5".into()));
    }
    let nmethods = buf[1] as usize;
    stream.read_exact(&mut buf[..nmethods]).await
        .map_err(|e| SshError::Russh(format!("socks5 methods: {e}")))?;
    stream.write_all(&[0x05, 0x00]).await
        .map_err(|e| SshError::Russh(format!("socks5 reply: {e}")))?;

    // 2. Request: VER CMD RSV ATYP DST.ADDR DST.PORT
    stream.read_exact(&mut buf[..4]).await
        .map_err(|e| SshError::Russh(format!("socks5 request: {e}")))?;
    if buf[0] != 0x05 || buf[1] != 0x01 {
        stream.write_all(&[0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]).await.ok();
        return Err(SshError::Russh("unsupported SOCKS5 command".into()));
    }

    let atyp = buf[3];
    let (dest_addr, dest_port) = match atyp {
        0x01 => {
            stream.read_exact(&mut buf[..4]).await.map_err(|e| SshError::Russh(format!("socks5 ipv4: {e}")))?;
            let addr = format!("{}.{}.{}.{}", buf[0], buf[1], buf[2], buf[3]);
            stream.read_exact(&mut buf[..2]).await.map_err(|e| SshError::Russh(format!("socks5 port: {e}")))?;
            (addr, u16::from_be_bytes([buf[0], buf[1]]))
        }
        0x03 => {
            stream.read_exact(&mut buf[..1]).await.map_err(|e| SshError::Russh(format!("socks5 domain len: {e}")))?;
            let len = buf[0] as usize;
            stream.read_exact(&mut buf[..len]).await.map_err(|e| SshError::Russh(format!("socks5 domain: {e}")))?;
            let addr = String::from_utf8_lossy(&buf[..len]).to_string();
            stream.read_exact(&mut buf[..2]).await.map_err(|e| SshError::Russh(format!("socks5 port: {e}")))?;
            (addr, u16::from_be_bytes([buf[0], buf[1]]))
        }
        0x04 => {
            stream.read_exact(&mut buf[..16]).await.map_err(|e| SshError::Russh(format!("socks5 ipv6: {e}")))?;
            let mut octets = [0u8; 16];
            octets.copy_from_slice(&buf[..16]);
            let addr = std::net::Ipv6Addr::from(octets).to_string();
            stream.read_exact(&mut buf[..2]).await.map_err(|e| SshError::Russh(format!("socks5 port: {e}")))?;
            (addr, u16::from_be_bytes([buf[0], buf[1]]))
        }
        _ => {
            stream.write_all(&[0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]).await.ok();
            return Err(SshError::Russh(format!("unsupported SOCKS5 ATYP {atyp}")));
        }
    };

    // 3. Open SSH channel then pipe
    let ch_result = conn
        .client_handle
        .lock()
        .await
        .channel_open_direct_tcpip(&dest_addr, dest_port as u32, "127.0.0.1", 0)
        .await;

    match ch_result {
        Ok(ch) => {
            stream.write_all(&[0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]).await.ok();
            pipe_channel_to_stream(ch, stream, handle).await
        }
        Err(e) => {
            stream.write_all(&[0x05, 0x01, 0x00, 0x01, 0, 0, 0, 0, 0, 0]).await.ok();
            Err(SshError::Russh(format!("channel open for SOCKS5: {e}")))
        }
    }
}
