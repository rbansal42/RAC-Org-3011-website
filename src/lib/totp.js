/**
 * Google Authenticator RFC 6238 TOTP Engine
 * Standard Web Crypto API HMAC-SHA1 Implementation (Zero Dependencies)
 */

// Convert Base32 Secret to Uint8Array
function base32ToBuf(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const output = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = alphabet.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

/**
 * Generate cryptographically random 16-character Base32 secret using window.crypto.getRandomValues
 */
export function generateRandomBase32Secret() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  let secret = '';
  for (let i = 0; i < 16; i++) {
    secret += alphabet[array[i] % alphabet.length];
  }
  return secret;
}

/**
 * Generate 6-digit TOTP code for a given secret and optional time offset
 */
export async function generateTOTP(secretBase32, timeOffsetInSeconds = 0) {
  try {
    const keyBytes = base32ToBuf(secretBase32);
    if (keyBytes.length === 0) return null;

    const epoch = Math.floor(Date.now() / 1000);
    const timeStep = 30;
    const counter = Math.floor((epoch + timeOffsetInSeconds) / timeStep);

    // 8-byte big-endian counter buffer
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(4, counter, false);

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, buffer);
    const sigBytes = new Uint8Array(signature);
    const offset = sigBytes[sigBytes.length - 1] & 0xf;
    const binary =
      ((sigBytes[offset] & 0x7f) << 24) |
      ((sigBytes[offset + 1] & 0xff) << 16) |
      ((sigBytes[offset + 2] & 0xff) << 8) |
      (sigBytes[offset + 3] & 0xff);

    const otp = (binary % 1000000).toString().padStart(6, '0');
    return otp;
  } catch (e) {
    console.error('TOTP calculation error:', e);
    return null;
  }
}

/**
 * Verify TOTP code (checks current time, -30s, and +30s to allow clock drift)
 */
export async function verifyTOTP(secretBase32, inputCode) {
  const cleanInput = (inputCode || '').trim();
  if (cleanInput.length !== 6 || !/^\d{6}$/.test(cleanInput)) {
    return false;
  }

  // Check -30s, 0s, +30s time windows (allows clock drift)
  for (const offset of [-30, 0, 30]) {
    const expected = await generateTOTP(secretBase32, offset);
    if (expected && expected === cleanInput) {
      return true;
    }
  }
  return false;
}
