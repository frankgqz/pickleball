import "./env";
import { prisma } from "../prisma/client";
async function main() {
  const players = await prisma.player.findMany({ where: { duprNumericId: { not: null } }, take: 3, select: { name: true, duprNumericId: true, duprScore: true } });
  console.log(JSON.stringify(players));
  await prisma.$disconnect();
}
main().catch(e => console.log("ERR:", e.message));
