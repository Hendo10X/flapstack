// Package crypto provides AES-GCM encryption-at-rest for vault content.
//
// Server-side key is loaded from the ENCRYPTION_KEY env var. Expected format
// is 64 hex chars (32 bytes / 256-bit key). If unset, a deterministic dev key
// is derived from a fixed string — DO NOT run that in production.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"
	"os"
)

const Prefix = "vault:v1:"

var ErrInvalidCiphertext = errors.New("invalid ciphertext")

func key() ([]byte, error) {
	v := os.Getenv("ENCRYPTION_KEY")
	if v == "" {
		// Dev-only fallback so the app boots without explicit config. The user
		// is warned via /healthz/env or README to set ENCRYPTION_KEY in prod.
		sum := sha256.Sum256([]byte("flapstack-dev-key-do-not-use-in-production"))
		return sum[:], nil
	}
	k, err := hex.DecodeString(v)
	if err != nil {
		return nil, errors.New("ENCRYPTION_KEY must be 64 hex chars")
	}
	if len(k) != 32 {
		return nil, errors.New("ENCRYPTION_KEY must decode to 32 bytes")
	}
	return k, nil
}

// Encrypt seals plaintext with AES-256-GCM. Output is base64(nonce || ciphertext)
// with the vault prefix so callers can identify ciphertexts.
func Encrypt(plaintext string) (string, error) {
	k, err := key()
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(k)
	if err != nil {
		return "", err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := aead.Seal(nonce, nonce, []byte(plaintext), nil)
	return Prefix + base64.RawStdEncoding.EncodeToString(sealed), nil
}

// Decrypt reverses Encrypt. If the string isn't a vault ciphertext, it's
// returned unchanged — letting handlers safely call Decrypt on any content.
func Decrypt(s string) (string, error) {
	if len(s) < len(Prefix) || s[:len(Prefix)] != Prefix {
		return s, nil
	}
	raw, err := base64.RawStdEncoding.DecodeString(s[len(Prefix):])
	if err != nil {
		return "", ErrInvalidCiphertext
	}
	k, err := key()
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(k)
	if err != nil {
		return "", err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < aead.NonceSize() {
		return "", ErrInvalidCiphertext
	}
	nonce, ciphertext := raw[:aead.NonceSize()], raw[aead.NonceSize():]
	plain, err := aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}
