import "./env";
async function main() {
  const at = process.env.DUPR_TOKEN!;
  const rt = process.env.DUPR_RT!;
  const dashHeaders = {
    Cookie: `__Host-dupr_at=${at}; __Host-dupr_rt=${rt}`,
    "x-dupr-client-capabilities": "totp,webauthn",
    origin: "https://dashboard.dupr.com",
    referer: "https://dashboard.dupr.com/",
    "Content-Type": "application/json",
  };
  const tries: Array<[string, string, RequestInit]> = [
    ["profile, full replica", "https://api.dupr.com/user/v1.0/profile", { headers: dashHeaders }],
    ["refresh GET, full replica", "https://api.dupr.com/user/v1.0/refresh", { headers: dashHeaders }],
    ["refresh POST, full replica", "https://api.dupr.com/user/v1.0/refresh", { method: "POST", headers: dashHeaders }],
    ["refresh POST rt body, full replica", "https://api.dupr.com/user/v1.0/refresh", { method: "POST", headers: dashHeaders, body: JSON.stringify({ refreshToken: rt }) }],
    ["token POST, full replica", "https://api.dupr.com/user/v1.0/token", { method: "POST", headers: dashHeaders, body: JSON.stringify({ refreshToken: rt }) }],
  ];
  for (const [label, url, init] of tries) {
    try {
      const r = await fetch(url, init);
      const d: any = await r.json().catch(() => ({}));
      const sc = r.headers.get("set-cookie") || "";
      const names = sc ? sc.split(",").map(c => c.split("=")[0].trim()).filter((v, i, a) => a.indexOf(v) === i).join(",") : "";
      console.log(`${label} -> ${r.status} ${d.status ?? ""}${names ? " | set-cookie: " + names : ""} | ${String(d.message ?? "").slice(0, 60)}`);
    } catch (e: any) { console.log(label, "ERR:", e.message); }
  }
}
main();
