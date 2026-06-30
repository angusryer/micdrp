/**
 * base64 <-> bytes helpers for Storage uploads.
 *
 * Captured audio is read off disk as base64 (react-native-fs), but Supabase
 * Storage wants raw bytes. These are pure and dependency-free (no `Buffer`/
 * `atob`) so they run on-device and in tests alike.
 */

const B64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Reverse lookup table for {@link base64ToBytes}, built once. */
const B64_LOOKUP: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < B64_CHARS.length; i++) {
    map[B64_CHARS[i]] = i;
  }
  return map;
})();

/**
 * Decode a base64 string to raw bytes. Ignores whitespace and `=` padding.
 */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const byteLen = Math.floor((len * 3) / 4);
  const out = new Uint8Array(byteLen);
  let o = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = B64_LOOKUP[clean[i]] ?? 0;
    const c1 = B64_LOOKUP[clean[i + 1]] ?? 0;
    const c2 = i + 2 < len ? B64_LOOKUP[clean[i + 2]] ?? 0 : 0;
    const c3 = i + 3 < len ? B64_LOOKUP[clean[i + 3]] ?? 0 : 0;
    if (o < byteLen) out[o++] = (c0 << 2) | (c1 >> 4);
    if (o < byteLen) out[o++] = ((c1 & 0x0f) << 4) | (c2 >> 2);
    if (o < byteLen) out[o++] = ((c2 & 0x03) << 6) | c3;
  }
  return out;
}
