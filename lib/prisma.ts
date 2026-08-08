// We need to use require() for the generated Prisma client
// because the import path doesn't work with TypeScript in Next.js

const { PrismaPg } = require("@prisma/adapter-pg");

interface GlobalThis {
  prisma: any;
}

const globalForPrisma = globalThis as GlobalThis;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString });
  
  // Use require to bypass TypeScript's path resolution
  const { PrismaClient } = require("@prisma/client");
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
