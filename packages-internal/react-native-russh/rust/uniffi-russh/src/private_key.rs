use rand::{Rng, RngExt};
use russh::keys::ssh_key::{
    self,
    private::{Ed25519Keypair, KeypairData, RsaKeypair},
    Cipher as SshCipher,
    HashAlg,
};
use russh::keys::{Algorithm, EcdsaCurve, PublicKeyBase64};

use crate::utils::SshError;

use base64::Engine as _;

#[derive(Debug, Clone, Copy, PartialEq, uniffi::Enum)]
pub enum KeyType {
    Rsa,
    Ecdsa,
    Ed25519,
    Ed448,
}

#[derive(Debug, Clone, PartialEq, uniffi::Record)]
pub struct GeneratedKeyMaterial {
    pub private_key: String,
    pub public_key: String,
    pub fingerprint_sha256: String,
    pub algorithm: String,
    pub bits: Option<u32>,
}

fn extract_key_material(
    key: &russh::keys::PrivateKey,
    bits: Option<u32>,
    private_key_pem: String,
) -> GeneratedKeyMaterial {
    let pk = key.public_key();
    let algorithm = pk.algorithm().to_string();
    let base64 = pk.public_key_base64();
    let public_key = format!("{algorithm} {base64}");
    let fingerprint_sha256 = format!("{}", pk.fingerprint(HashAlg::Sha256));
    GeneratedKeyMaterial {
        private_key: private_key_pem,
        public_key,
        fingerprint_sha256,
        algorithm,
        bits,
    }
}

#[uniffi::export]
pub fn validate_private_key(
    private_key_content: String,
    passphrase: Option<String>,
) -> Result<GeneratedKeyMaterial, SshError> {
    let (canonical, parsed) = match &passphrase {
        Some(pass) if !pass.is_empty() => {
            let raw = ssh_key::PrivateKey::from_openssh(&private_key_content)?;
            let decrypted = raw.decrypt(pass.as_bytes())?;
            let decrypted_pem = decrypted.to_openssh(ssh_key::LineEnding::LF)?.to_string();
            normalize_openssh_ed25519_seed_key(&decrypted_pem)?
        }
        _ => normalize_openssh_ed25519_seed_key(&private_key_content)?,
    };
    Ok(extract_key_material(&parsed, None, canonical))
}

fn parse_cipher(name: &str) -> SshCipher {
    match name {
        "aes256-ctr" => SshCipher::Aes256Ctr,
        "aes128-ctr" => SshCipher::Aes128Ctr,
        "3des-cbc" => SshCipher::TDesCbc,
        _ => SshCipher::Aes256Ctr,
    }
}

fn parse_ecdsa_curve(name: &str) -> EcdsaCurve {
    match name {
        "nistp384" => EcdsaCurve::NistP384,
        "nistp521" => EcdsaCurve::NistP521,
        _ => EcdsaCurve::NistP256,
    }
}

#[uniffi::export]
pub fn generate_key_pair(
    key_type: KeyType,
    passphrase: Option<String>,
    cipher: Option<String>,
    rounds: Option<u32>,
    ecdsa_curve: Option<String>,
    rsa_bits: Option<u32>,
) -> Result<GeneratedKeyMaterial, SshError> {
    let mut rng = rand::rng();
    let bits: Option<u32>;
    let key = match key_type {
        KeyType::Rsa => {
            let b = rsa_bits.unwrap_or(2048);
            bits = Some(b);
            let key_data = KeypairData::from(RsaKeypair::random(&mut rng, b as usize)?);
            ssh_key::PrivateKey::new(key_data, "")?
        }
        KeyType::Ecdsa => {
            let curve = ecdsa_curve.as_deref().map(parse_ecdsa_curve).unwrap_or(EcdsaCurve::NistP256);
            bits = Some(match curve {
                EcdsaCurve::NistP256 => 256,
                EcdsaCurve::NistP384 => 384,
                EcdsaCurve::NistP521 => 521,
            });
            russh::keys::PrivateKey::random(
                &mut rng,
                Algorithm::Ecdsa { curve },
            )?
        }
        KeyType::Ed25519 => {
            bits = None;
            russh::keys::PrivateKey::random(&mut rng, Algorithm::Ed25519)?
        }
        KeyType::Ed448 => return Err(SshError::UnsupportedKeyType),
    };

    // Extract public key material before (potentially) encrypting the private key.
    // Scoped so the borrow on `key` is released before encrypt_with() consumes it.
    let (algorithm, public_key, fingerprint_sha256) = {
        let pk = key.public_key();
        let algo = pk.algorithm().to_string();
        let b64 = pk.public_key_base64();
        let pubkey = format!("{algo} {b64}");
        let fp = format!("{}", pk.fingerprint(HashAlg::Sha256));
        (algo, pubkey, fp)
    };

    let should_encrypt = passphrase
        .as_ref()
        .is_some_and(|p| !p.is_empty());

    let private_key_pem = if should_encrypt {
        let pass = passphrase.unwrap();
        let c = cipher.as_deref().map(parse_cipher).unwrap_or(SshCipher::Aes256Ctr);
        let r = rounds.unwrap_or(16);
        let mut salt = vec![0u8; 16];
        rng.fill(&mut salt[..]);
        let kdf = ssh_key::Kdf::Bcrypt { salt, rounds: r };
        let checkint = rng.next_u32();
        let encrypted = key.encrypt_with(c, kdf, checkint, pass.as_bytes())?;
        encrypted
            .to_openssh(ssh_key::LineEnding::LF)?
            .to_string()
    } else {
        key
            .to_openssh(ssh_key::LineEnding::LF)?
            .to_string()
    };

    Ok(GeneratedKeyMaterial {
        private_key: private_key_pem,
        public_key,
        fingerprint_sha256,
        algorithm,
        bits,
    })
}

// Best-effort fix for OpenSSH ed25519 keys that store only a 32-byte seed in
// the private section (instead of 64 bytes consisting of seed || public).
// If the input matches an unencrypted OpenSSH ed25519 key with a 32-byte
// private field, this function returns a normalized PEM string with the
// correct 64-byte private field (seed || public). Otherwise, returns None.
pub(crate) fn normalize_openssh_ed25519_seed_key(
    input: &str,
) -> Result<(String, russh::keys::PrivateKey), russh::keys::ssh_key::Error> {
    // If it already parses, return canonical string and parsed key.
    if let Ok(parsed) = russh::keys::PrivateKey::from_openssh(input) {
        let canonical = parsed.to_openssh(ssh_key::LineEnding::LF)?.to_string();
        return Ok((canonical, parsed));
    }

    // Try to fix seed-only Ed25519 keys and re-parse.
    fn try_fix_seed_only_ed25519(input: &str) -> Option<String> {
        // Minimal OpenSSH container parse to detect seed-only Ed25519
        const HEADER: &str = "-----BEGIN OPENSSH PRIVATE KEY-----";
        const FOOTER: &str = "-----END OPENSSH PRIVATE KEY-----";
        let (start, end) = match (input.find(HEADER), input.find(FOOTER)) {
            (Some(h), Some(f)) => (h + HEADER.len(), f),
            _ => return None,
        };
        let body = &input[start..end];
        let b64: String = body
            .lines()
            .map(str::trim)
            .filter(|l| !l.is_empty())
            .collect::<Vec<_>>()
            .join("");

        let raw = match base64::engine::general_purpose::STANDARD.decode(b64.as_bytes()) {
            Ok(v) => v,
            Err(_) => return None,
        };

        let mut idx = 0usize;
        let magic = b"openssh-key-v1\0";
        if raw.len() < magic.len() || &raw[..magic.len()] != magic {
            return None;
        }
        idx += magic.len();

        fn read_u32(buf: &[u8], idx: &mut usize) -> Option<u32> {
            if *idx + 4 > buf.len() {
                return None;
            }
            let v = u32::from_be_bytes([buf[*idx], buf[*idx + 1], buf[*idx + 2], buf[*idx + 3]]);
            *idx += 4;
            Some(v)
        }
        fn read_string<'a>(buf: &'a [u8], idx: &mut usize) -> Option<&'a [u8]> {
            let n = read_u32(buf, idx)? as usize;
            if *idx + n > buf.len() {
                return None;
            }
            let s = &buf[*idx..*idx + n];
            *idx += n;
            Some(s)
        }

        let ciphername = read_string(&raw, &mut idx)?;
        let kdfname = read_string(&raw, &mut idx)?;
        let _kdfopts = read_string(&raw, &mut idx)?;
        if ciphername != b"none" || kdfname != b"none" {
            return None;
        }

        let nkeys = read_u32(&raw, &mut idx)? as usize;
        for _ in 0..nkeys {
            let _ = read_string(&raw, &mut idx)?;
        }
        let private_block = read_string(&raw, &mut idx)?;

        let mut pidx = 0usize;
        let check1 = read_u32(private_block, &mut pidx)?;
        let check2 = read_u32(private_block, &mut pidx)?;
        if check1 != check2 {
            return None;
        }

        let alg = read_string(private_block, &mut pidx)?;
        if alg != b"ssh-ed25519" {
            return None;
        }
        let _pubkey = read_string(private_block, &mut pidx)?;
        let privkey = read_string(private_block, &mut pidx)?;
        let comment_bytes = read_string(private_block, &mut pidx)?;

        // Build canonical keypair bytes
        let mut keypair_bytes = [0u8; 64];
        if privkey.len() == 32 {
            let seed: [u8; 32] = match privkey.try_into() {
                Ok(a) => a,
                Err(_) => return None,
            };
            let sk = ed25519_dalek::SigningKey::from_bytes(&seed);
            let vk = sk.verifying_key();
            let pub_bytes = vk.to_bytes();
            keypair_bytes[..32].copy_from_slice(&seed);
            keypair_bytes[32..].copy_from_slice(pub_bytes.as_ref());
        } else if privkey.len() == 64 {
            keypair_bytes.copy_from_slice(privkey);
        } else {
            return None;
        }
        let ed_kp = match Ed25519Keypair::from_bytes(&keypair_bytes) {
            Ok(k) => k,
            Err(_) => return None,
        };
        let comment = String::from_utf8(comment_bytes.to_vec()).unwrap_or_default();
        let key_data = KeypairData::from(ed_kp);
        let private = match ssh_key::PrivateKey::new(key_data, comment) {
            Ok(p) => p,
            Err(_) => return None,
        };
        match private.to_openssh(ssh_key::LineEnding::LF) {
            Ok(s) => Some(s.to_string()),
            Err(_) => None,
        }
    }

    let candidate = try_fix_seed_only_ed25519(input).unwrap_or_else(|| input.to_string());
    let parsed = russh::keys::PrivateKey::from_openssh(&candidate)?;
    let canonical = parsed.to_openssh(ssh_key::LineEnding::LF)?.to_string();
    Ok((canonical, parsed))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_private_key_rejects_invalid_constant() {
        let invalid_key = "this is not a private key".to_string();
        let result = validate_private_key(invalid_key, None);
        assert!(result.is_err(), "Expected Err for invalid key content");
    }

    #[test]
    fn validate_private_key_accepts_1() {
        // Generated with: ssh-keygen -t ed25519 -C "test-ed25519@fressh.com" -f ./ed25519-with-comment
        let valid_key = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACC7PhmC0yS0Q8LcUkRnoYCxpb4gkCjJhadvvf+TDlRBJwAAAKCX5GEsl+Rh
LAAAAAtzc2gtZWQyNTUxOQAAACC7PhmC0yS0Q8LcUkRnoYCxpb4gkCjJhadvvf+TDlRBJw
AAAEBmrg8TL0+2xypHjVpFeuQmgQf3Qn/A45Jz+zCwVgoBt7s+GYLTJLRDwtxSRGehgLGl
viCQKMmFp2+9/5MOVEEnAAAAF3Rlc3QtZWQyNTUxOUBmcmVzc2guY29tAQIDBAUG
-----END OPENSSH PRIVATE KEY-----
"
        .to_string();
        let result = validate_private_key(valid_key, None);
        assert!(result.is_ok(), "Expected Ok for valid key content");
        let material = result.unwrap();
        assert_eq!(material.algorithm, "ssh-ed25519");
        assert!(!material.public_key.is_empty());
        assert!(material.fingerprint_sha256.starts_with("SHA256:"));
    }
    #[test]
    fn validate_private_key_accepts_2() {
        // Generated with: ssh-keygen -t ed25519 -f ./ed25519-wo-comment
        let valid_key = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACD/icJYduvcR9JPKw9g/bPWpsgS0IAaJxlYL5yeuOaNMgAAAJjDAt7NwwLe
zQAAAAtzc2gtZWQyNTUxOQAAACD/icJYduvcR9JPKw9g/bPWpsgS0IAaJxlYL5yeuOaNMg
AAAEDYE6BYf7QlpAaJCfaxA/HN487NM9iIF7VGue/iefZIyP+Jwlh269xH0k8rD2D9s9am
yBLQgBonGVgvnJ645o0yAAAADmV0aGFuQEV0aGFuLVBDAQIDBAUGBw==
-----END OPENSSH PRIVATE KEY-----
"
        .to_string();
        let result = validate_private_key(valid_key, None);
        assert!(result.is_ok(), "Expected Ok for valid key content");
    }
    #[test]
    fn validate_private_key_accepts_3() {
        // Generated with: ssh-keygen -t ed25519 -C "" -N "" -f ./ed25519-wo-comment-and-hostname
        let valid_key = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACDt2ZcFrEhB8/B4uu30mPIi3BWWEa/wE//IUXLeL9YevAAAAIg90nGHPdJx
hwAAAAtzc2gtZWQyNTUxOQAAACDt2ZcFrEhB8/B4uu30mPIi3BWWEa/wE//IUXLeL9YevA
AAAEBMtZWpjpVnzDhYKR3V09SLohGqkW7HgMXoF8f0zf+/Pu3ZlwWsSEHz8Hi67fSY8iLc
FZYRr/AT/8hRct4v1h68AAAAAAECAwQF
-----END OPENSSH PRIVATE KEY-----
"
        .to_string();
        let result = validate_private_key(valid_key, None);
        assert!(result.is_ok(), "Expected Ok for valid key content");
    }
    #[test]
    fn validate_private_key_accepts_4() {
        // Generated with juicessh
        let valid_key = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZWQyNTUxOQAAACCh5IbLI9ypdFzNW8WvezgBrzJT/2mT9BKSdZScB4EYoQAAAJB8YyoafGMqGgAAAAtzc2gtZWQyNTUxOQAAACCh5IbLI9ypdFzNW8WvezgBrzJT/2mT9BKSdZScB4EYoQAAAECpYzHTSiKC2iehjck1n8GAp5mdGuB2J5vV+9U3MAvthKHkhssj3Kl0XM1bxa97OAGvMlP/aZP0EpJ1lJwHgRihAAAAAAECAwQFBgcICQoLDA0=
-----END OPENSSH PRIVATE KEY-----
".to_string();
        let result = validate_private_key(valid_key, None);
        assert!(result.is_ok(), "Expected Ok for valid key content");
    }
}
