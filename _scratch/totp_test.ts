// RFC 6238 test vectors with the SHA1 secret "12345678901234567890"
function base32Decode(s: string): Buffer {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const idx = A.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}
import crypto from "crypto";
function totpAt(secretBase32: string, counter: number, digits = 6): string {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]) % 10 ** digits;
  return code.toString().padStart(digits, "0");
}
const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // "12345678901234567890"
const vectors: Array<[number, string]> = [
  [1, "94287082"],   // T=59
  [37037036, "07081804"],   // T=1111111109
  [37037037, "14050471"],   // T=1111111111
];
let ok = true;
for (const [c, expect] of vectors) {
  const got8 = totpAt(SECRET, c, 8);
  const got6 = totpAt(SECRET, c, 6);
  console.log(`counter ${c}: 8-digit ${got8} (expect ${expect}) ${got8 === expect ? "OK" : "FAIL"} | 6-digit ${got6}`);
  if (got8 !== expect) ok = false;
}
console.log(ok ? "TOTP IMPLEMENTATION VALID" : "TOTP IMPLEMENTATION BROKEN");
