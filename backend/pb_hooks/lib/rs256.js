// RS256 signature verification in plain JavaScript (INV-ACCOUNT-024).
//
// PocketBase's JS runtime verifies only HMAC tokens, and Apple signs with RSA.
// The check rebuilds the exact PKCS#1 v1.5 encoding the signature must decode
// to and compares the whole of it; nothing is parsed out of the decoded
// signature, which is what forged-signature attacks on lax verifiers exploit.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** base64url text to an array of byte values. */
function bytes(text) {
  const out = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of text.replace(/=+$/, "")) {
    const value = ALPHABET.indexOf(ch.replace("+", "-").replace("/", "_"));
    if (value < 0) throw new Error("not base64url");
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return out;
}

const hex = (list) => list.map((b) => (b < 16 ? "0" : "") + b.toString(16)).join("");

/** base64url text decoded as UTF-8 JSON. */
function json(text) {
  const encoded = bytes(text).map((b) => "%" + (b < 16 ? "0" : "") + b.toString(16)).join("");
  return JSON.parse(decodeURIComponent(encoded));
}

function modPow(base, exponent, modulus) {
  let result = 1n;
  base %= modulus;
  while (exponent > 0n) {
    if (exponent & 1n) result = (result * base) % modulus;
    base = (base * base) % modulus;
    exponent >>= 1n;
  }
  return result;
}

const DIGEST_INFO_SHA256 = "3031300d060960864801650304020105000420";

/** Whether `signature` (base64url) signs `input` under the RSA key `jwk`. */
function verify(input, signature, jwk) {
  const n = BigInt("0x" + hex(bytes(jwk.n)));
  const e = BigInt("0x" + hex(bytes(jwk.e)));
  const k = bytes(jwk.n).length;
  const s = BigInt("0x" + hex(bytes(signature)));
  if (k < 256 || s >= n) return false;
  const tail = "00" + DIGEST_INFO_SHA256 + $security.sha256(input);
  const expected = "0001" + "ff".repeat(k - 2 - tail.length / 2) + tail;
  const decoded = modPow(s, e, n).toString(16).padStart(k * 2, "0");
  return decoded === expected;
}

/** Split a compact JWT, returning its header, claims and signing parts. */
function decode(token) {
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  try {
    return { header: json(parts[0]), claims: json(parts[1]), input: parts[0] + "." + parts[1], signature: parts[2] };
  } catch (_) {
    return null;
  }
}

module.exports = { verify, decode };
