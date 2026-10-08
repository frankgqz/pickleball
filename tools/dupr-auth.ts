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

function saveToken(token: string) {
  let env = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const line = `DUPR_TOKEN=${token}`;
  if (/^DUPR_TOKEN=.*$/m.test(env)) env = env.replace(/^DUPR_TOKEN=.*$/m, line);
  else env = env.trimEnd() + "\n" + line + "\n";
  fs.writeFileSync(ENV_PATH, env);
  console.log(`\n✓ DUPR_TOKEN saved to .env (…${token.slice(-4)}).`);
  console.log("  Next: copy the DUPR_TOKEN value from .env into Vercel");
  console.log("  (Settings -> Environment Variables, NO quotes) -> Redeploy.");
}

async function login() {
  const env = loadEnv();
  if (!env.DUPR_EMAIL || !env.DUPR_PASSWORD) {
    console.log("DUPR_EMAIL / DUPR_PASSWORD missing in .env"); return;
  }
  const res = await fetch(`${BASE}/auth/v1.0/login/`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.DUPR_EMAIL, password: env.DUPR_PASSWORD }),
  });
  const data: any = await res.json();
  if (data.status === "SUCCESS" && data.result?.accessToken) {
    saveToken(data.result.accessToken);
    return;
  }
  if (data.errorCode === "2FA_CHALLENGE_REQUIRED" && data.requirements?.[0]?.challengeToken) {
    const challengeToken = data.requirements[0].challengeToken;
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
  const endpoints = [
    `${BASE}/auth/v1.0/2fa/verify/`,   // proven winner 2026-10-08
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
  for (const [url, body, extraHeaders] of candidates) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(extraHeaders as any) },
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
        if (at) {
          saveToken(at[1]);
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
