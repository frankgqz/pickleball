import "./env";
async function main() {
  const at = process.env.DUPR_TOKEN!;
  const r = await fetch("https://api.dupr.gg/player/v1.0/6698045911", {
    headers: { Cookie: `__Host-dupr_at=${at}`, "Content-Type": "application/json" },
  });
  const d: any = await r.json();
  const res = d.result ?? d;
  console.log("fetch:", r.status, d.status ?? "", "| keys:", res && typeof res === "object" ? Object.keys(res).join(",").slice(0, 160) : typeof res);
  console.log("fullName:", JSON.stringify(res?.fullName), "| ratings:", JSON.stringify(res?.ratings).slice(0, 80));
  const sc = r.headers.get("set-cookie") || "";
  console.log("set-cookie on use:", sc ? sc.split(",").map(c => c.split("=")[0].trim()).filter((v,i,a)=>a.indexOf(v)===i).join(",") : "NONE (session does not slide)");
}
main().catch(e => console.log("ERR:", e.message));
