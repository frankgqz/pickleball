// We need to use require() for the generated Prisma client
const { PrismaPg } = require("@prisma/adapter-pg");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForPrisma = global as any;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString });
  const { PrismaClient } = require("@prisma/client");
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
