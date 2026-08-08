import { PrismaClient } from ".prisma/client";

class PrismaClientSingleton {
  private static instance: PrismaClient | null = null;

  static getClient(): PrismaClient {
    if (!this.instance) {
      const { PrismaPg } = require("@prisma/adapter-pg");
      const connectionString = process.env.DATABASE_URL!;
      const adapter = new PrismaPg({ connectionString });
      this.instance = new PrismaClient({ adapter });
    }
    return this.instance;
  }
}

export const prisma = PrismaClientSingleton.getClient();
