import "./env";
async function main() {
  const r = await fetch("https://api.dupr.gg/auth/v1.0/login/", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.DUPR_EMAIL, password: process.env.DUPR_PASSWORD }),
  });
  const d: any = await r.json();
  const req = d.requirements?.[0];
  console.log("status:", d.status, "| errorCode:", d.errorCode);
  console.log("twoFactorMethods:", JSON.stringify(d.twoFactorMethods), "| defaultMethod:", d.defaultMethod);
  if (req) console.log("requirements[0]:", JSON.stringify({ ...req, challengeToken: "<jwt>" }).slice(0, 300));
}
main().catch(e => console.log("ERR:", e.message));
