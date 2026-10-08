// DUPR token ritual (stopgap for 2FA-enforced accounts).
//
//   npm run dupr:auth          -> try a silent login; if DUPR demands an email
//                                 code, the challenge is saved and you'll be
//                                 told to run `npm run dupr:code 123456`.
//   npm run dupr:code 123456   -> complete the emailed code (typed HERE, never
//                                 in chat), saves DUPR_TOKEN into .env.
//
// The app prefers process.env.DUPR_TOKEN and skips login entirely.
import fs from "fs";
import path from "path";
import readline from "readline";

const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
const STATE_PATH = path.join(ROOT, "tools", ".dupr-challenge.json");
const BASE = "https://api.dupr.gg";

// ===== TOTP (RFC 6238) — generates the 6-digit code from DUPR_TOTP_SECRET =====
import crypto from "crypto";
function base32Decode(s: string): Buffer {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const idx = A.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}
function totpCode(secretBase32: string): string {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]) %
    1000000;
  return code.toString().padStart(6, "0");
}

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

async function saveTokensToDb(at: string, rt?: string) {
  try {
    const { prisma } = await import("../prisma/client");
    await prisma.authState.upsert({ where: { key: "dupr_at" }, update: { value: at }, create: { key: "dupr_at", value: at } });
    if (rt) await prisma.authState.upsert({ where: { key: "dupr_rt" }, update: { value: rt }, create: { key: "dupr_rt", value: rt } });
    await prisma.$disconnect();
    console.log("  ✓ tokens saved to the database (production picks them up automatically)");
  } catch (e) {
    console.log("  ✗ TOKEN RENEWED BUT DB SAVE FAILED (production reads the DB!):", String((e as Error).message).slice(0, 70));
    process.exitCode = 1; // watchdog: non-zero exit -> Telegram alert
  }
}

function saveToken(token: string, rt?: string) {
  let env = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const line = `DUPR_TOKEN=${token}`;
  if (/^DUPR_TOKEN=.*$/m.test(env)) env = env.replace(/^DUPR_TOKEN=.*$/m, line);
  else env = env.trimEnd() + "\n" + line + "\n";
  if (rt) {
    const rline = `DUPR_RT=${rt}`;
    if (/^DUPR_RT=.*$/m.test(env)) env = env.replace(/^DUPR_RT=.*$/m, rline);
    else env = env.trimEnd() + "\n" + rline + "\n";
  }
  fs.writeFileSync(ENV_PATH, env);
  console.log(`\n✓ DUPR_TOKEN saved to .env (…${token.slice(-4)}).`);
  void saveTokensToDb(token, rt);
}

function daysLeftOnToken(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return payload.exp ? (payload.exp * 1000 - Date.now()) / 86400000 : null;
  } catch { return null; }
}

async function login() {
  const env = loadEnv();
  // Cron mode: skip entirely while the token has plenty of life (≥ 7 days).
  const current = env.DUPR_TOKEN;
  const force = process.argv.includes("--force");
  if (current && !force) {
    const days = daysLeftOnToken(current);
    if (days !== null && days >= 7) {
      console.log(`Token still fresh (${days.toFixed(1)} days left) — nothing to do.`);
      return;
    }
    console.log(`Token has ${days?.toFixed(1) ?? "?"} days left — renewing...`);
  }
  if (!env.DUPR_EMAIL || !env.DUPR_PASSWORD) {
    console.log("DUPR_EMAIL / DUPR_PASSWORD missing in .env"); return;
  }
  const res = await fetch(`${BASE}/auth/v1.0/login/`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-dupr-client-capabilities": "totp,webauthn" },
    body: JSON.stringify({ email: env.DUPR_EMAIL, password: env.DUPR_PASSWORD }),
  });
  const data: any = await res.json();
  if (data.status === "SUCCESS" && data.result?.accessToken) {
    saveToken(data.result.accessToken);
    return;
  }
  if (data.errorCode === "2FA_CHALLENGE_REQUIRED" && data.requirements?.[0]?.challengeToken) {
    const challengeToken = data.requirements[0].challengeToken;
    const env = loadEnv();
    if (env.DUPR_TOTP_SECRET) {
      console.log("2FA challenge — trying generated TOTP code (3 quick attempts)...");
      fs.writeFileSync(STATE_PATH, JSON.stringify({ challengeToken }, null, 2));
      // ONLY the exact endpoint + plain body, so a failure does not burn the
      // challenge — then a manual `dupr:code <GA code>` can still test it.
      for (const off of [-1, 0, 1]) {
        const counter = Math.floor(Date.now() / 1000 / 30) + off;
        const key = base32Decode(env.DUPR_TOTP_SECRET);
        const buf = Buffer.alloc(8);
        buf.writeBigUInt64BE(BigInt(counter));
        const hmac = crypto.createHmac("sha1", key).update(buf).digest();
        const o = hmac[hmac.length - 1] & 0x0f;
        const c = (((hmac[o] & 0x7f) << 24) | (hmac[o + 1] << 16) | (hmac[o + 2] << 8) | hmac[o + 3]) % 1000000;
        const res = await fetch("https://api.dupr.com/auth/v1.0/2fa/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-dupr-client-capabilities": "totp,webauthn" },
          body: JSON.stringify({ challengeToken, code: c.toString().padStart(6, "0"), method: { type: "urn:dupr:second-factor:totp" } }),
        });
        const d: any = await res.json().catch(() => ({}));
        const sc = res.headers.get("set-cookie") || "";
        const at = sc.match(/(?:__Host-)?dupr_at=([^;\s,]+)/);
        const rt = sc.match(/(?:__Host-)?dupr_rt=([^;\s,]+)/);
        if (at) {
          fs.unlinkSync(STATE_PATH);
          saveToken(at[1], rt?.[1]);
          return;
        }
        console.log(`  attempt ${off}: ${d.status ?? res.status} ${String(d.message ?? "").slice(0, 60)}`);
      }
      console.log("Auto-TOTP failed. To test with your REAL authenticator code, run now:");
      console.log("  npm run dupr:code <the 6 digits from Google Authenticator>");
      return;
    }
    fs.writeFileSync(STATE_PATH, JSON.stringify({ challengeToken }, null, 2));
    console.log("DUPR wants an emailed 6-digit code (it just sent one).");
    console.log("When it arrives, run:  npm run dupr:code 123456");
    return;
  }
  if (String(data.message || "").includes("Login limit exceeded")) {
    console.log("DUPR rate-limited the login:", data.message);
    return;
  }
  console.log("Login failed:", data.status, data.message || JSON.stringify(data).slice(0, 160));
}

async function verifyCode(code: string) {
  if (!fs.existsSync(STATE_PATH)) {
    console.log("No saved challenge — run `npm run dupr:auth` first."); return;
  }
  const { challengeToken } = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  // The consumer 2FA verify endpoint isn't publicly documented — try the
  // likely shapes and print whichever the API accepts.
  // "Invalid token" earlier = the gateway rejected the challengeToken as a
  // Bearer header before routing — so try each endpoint BOTH with and without
  // an Authorization header (token travels in the body).
  // TOTP challenges accept codes in a ±1 window and may want the method URN.
  const codes: string[] = [];
  if (process.env.DUPR_TOTP_SECRET) {
    for (const algo of ["sha1", "sha256", "sha512"]) {
      for (const offset of [-1, 0, 1]) {
        const counter = Math.floor(Date.now() / 1000 / 30) + offset;
        const key = base32Decode(process.env.DUPR_TOTP_SECRET);
        const buf = Buffer.alloc(8);
        buf.writeBigUInt64BE(BigInt(counter));
        const hmac = crypto.createHmac(algo, key).update(buf).digest();
        const off = hmac[hmac.length - 1] & 0x0f;
        const c = (((hmac[off] & 0x7f) << 24) | (hmac[off + 1] << 16) | (hmac[off + 2] << 8) | hmac[off + 3]) % 1000000;
        codes.push(c.toString().padStart(6, "0"));
      }
    }
  }
  codes.push(code); // whatever was passed in (email code fallback)

  const endpoints = [
    "https://api.dupr.com/auth/v1.0/2fa/verify", // EXACT dashboard endpoint (no slash) 2026-10-08
    `${BASE}/auth/v1.0/2fa/verify/`,   // earlier winner (email flow)
    `${BASE}/auth/v1.0/login/verify/`,
    `${BASE}/auth/v1.0/verify/`,
    `${BASE}/auth/v1.0/2fa/verify/`,
    `${BASE}/auth/v1.0/challenge/verify/`,
  ];
  const candidates: Array<[string, object, object]> = [];
  for (const url of endpoints) {
    for (const headers of [{}, { Authorization: `Bearer ${challengeToken}` }]) {
      for (const body of [{ challengeToken, code }, { code }]) {
        candidates.push([url, body, headers]);
      }
    }
  }
  // Body variants for the winner: code/otp x optional method URN.
  const bodies = (ch: string, c: string) => [
    // EXACT dashboard shape (2026-10-08 payload peek): method is an OBJECT
    { challengeToken: ch, code: c, method: { type: "urn:dupr:second-factor:totp" } },
    { challengeToken: ch, code: c },
    { challengeToken: ch, otp: c, method: { type: "urn:dupr:second-factor:totp" } },
  ];
  const expanded: Array<[string, object, object]> = [];
  for (const [url, body, hdrs] of candidates) {
    const b = body as any;
    if (b.challengeToken && (b.code || b.otp)) {
      for (const c of codes) for (const variant of bodies(b.challengeToken, c)) expanded.push([url, variant, hdrs]);
    } else {
      expanded.push([url, body, hdrs]);
    }
  }
  for (const [url, body, extraHeaders] of expanded) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-dupr-client-capabilities": "totp,webauthn", ...(extraHeaders as any) },
        body: JSON.stringify(body),
      });
      const data: any = await res.json();
      const r = data.result;
      const token =
        (typeof r === "string" ? r : null) ??
        r?.accessToken ?? r?.access_token ?? r?.token ?? r?.authToken ?? r?.jwt ??
        data.accessToken ?? data.access_token ?? data.token;
      if (token) {
        fs.unlinkSync(STATE_PATH);
        saveToken(token);
        return;
      }
      if (data.status === "SUCCESS") {
        fs.unlinkSync(STATE_PATH);
        // DUPR sets the token as an HttpOnly cookie (__Host-dupr_at, ~30-day
        // expiry) — grab that value first; it works as a Bearer token.
        const setCookie = res.headers.get("set-cookie") || "";
        const at = setCookie.match(/(?:__Host-)?dupr_at=([^;\s,]+)/);
        const rt = setCookie.match(/(?:__Host-)?dupr_rt=([^;\s,]+)/);
        if (at) {
          saveToken(at[1], rt?.[1]);
          return;
        }
        // Fallback: scan the whole response for a JWT (three dot-separated
        // segments) and save the longest.
        const jwts: string[] = [];
        const walk = (v: any) => {
          if (typeof v === "string" && /^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}$/.test(v)) jwts.push(v);
          else if (v && typeof v === "object") Object.values(v).forEach(walk);
        };
        walk(data);
        if (jwts.length > 0) {
          jwts.sort((a, b) => b.length - a.length);
          saveToken(jwts[0]);
          return;
        }
        console.log("\nLOGIN SUCCEEDED but no JWT found in the response. Shape:");
        console.log("  top keys:", Object.keys(data).join(","));
        console.log("  result keys:", r && typeof r === "object" ? Object.keys(r).join(",") : typeof r);
        if (r?.user && typeof r.user === "object") console.log("  result.user keys:", Object.keys(r.user).join(","));
        const sc = res.headers.get("set-cookie");
        console.log("  set-cookie:", sc ? sc.split(",").map(c => c.split("=")[0].trim()).join(",") : "none");
        return;
      }
      console.log(`  ${url} ${Object.keys(extraHeaders).length ? "+bearer" : "no-auth"} ${JSON.stringify(body).slice(0, 40)} -> ${data.status ?? res.status} ${String(data.message ?? "").slice(0, 50)}`);
    } catch {
      console.log(`  ${url} -> network/parse error`);
    }
  }
  console.log("\nNone of the candidate endpoints accepted the code.");
  console.log("Easiest exact answer: on the DUPR website, enter the code once with");
  console.log("browser DevTools open (F12 -> Network) and tell Hermes the URL of the");
  console.log("request that carries the code. Then it's wired exactly.");
}

const [, , cmd, arg] = process.argv;
if (cmd === "code" && arg) verifyCode(arg).catch(e => console.log("ERR:", e.message));
else login().catch(e => console.log("ERR:", e.message));
