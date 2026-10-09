import "./env";
async function main() {
  const rt = process.env.DUPR_RT!;
  const at = process.env.DUPR_TOKEN!;
  console.log("rt present:", !!rt, "| at present:", !!at);
  const tries: Array<[string, string, RequestInit]> = [
    ["GET refresh, Bearer at", "https://api.dupr.gg/auth/v1.0/refresh", { headers: { Authorization: `Bearer ${at}` } }],
    ["GET refresh, Bearer rt", "https://api.dupr.gg/auth/v1.0/refresh", { headers: { Authorization: `Bearer ${rt}` } }],
    ["GET refresh, Bearer at + rt cookie", "https://api.dupr.gg/auth/v1.0/refresh", { headers: { Authorization: `Bearer ${at}`, Cookie: `__Host-dupr_rt=${rt}` } }],
    ["GET refresh, both cookies + bearer at", "https://api.dupr.gg/auth/v1.0/refresh", { headers: { Authorization: `Bearer ${at}`, Cookie: `__Host-dupr_at=${at}; __Host-dupr_rt=${rt}` } }],
  ];
  for (const [label, url, init] of tries) {
    const r = await fetch(url, init);
    const d: any = await r.json().catch(() => ({}));
    const sc = r.headers.get("set-cookie") || "";
    const hasNewAt = /dupr_at=/.test(sc);
    console.log(label, "->", r.status, d.status ?? "", hasNewAt ? "| NEW AT COOKIE SET" : "", "| msg:", String(d.message ?? "").slice(0, 60), "| keys:", d.result && typeof d.result === "object" ? Object.keys(d.result).join(",").slice(0, 80) : typeof d.result);
  }
}
main().catch(e => console.log("ERR:", e.message));
