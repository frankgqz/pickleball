import "./env";
async function main() {
  const at = process.env.DUPR_TOKEN!;
  const h = { Cookie: `__Host-dupr_at=${at}`, "x-dupr-client-capabilities": "totp,webauthn" };
  const tries: Array<[string, string]> = [
    ["player/v1.0/AB12CDE (short code in the numeric slot)", "https://api.dupr.com/player/v1.0/AB12CDE"],
    ["player/v1.0/search?query=", "https://api.dupr.com/player/v1.0/search?query=frank"],
    ["search/v1.0/player?duprId=", "https://api.dupr.com/search/v1.0/player?duprId=AB12CDE"],
    ["player/v1.0?duprId=AB12CDE", "https://api.dupr.com/player/v1.0?duprId=AB12CDE"],
  ];
  for (const [label, url] of tries) {
    const r = await fetch(url, { headers: h });
    const d: any = await r.json().catch(() => ({}));
    console.log(label, "->", r.status, "|", String(d.message ?? d.status ?? "").slice(0, 70));
  }
}
main().catch(e => console.log("ERR:", e.message));
