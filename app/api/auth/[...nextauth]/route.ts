import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async session({ session, token }: { session: any; token: any }) {
      if (session?.user) {
        // @ts-ignore
        session.user.id = token.sub;
      }
      return session;  // ADD THIS LINE
    },
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  events: {
    async createUser({ user }: { user: any }) {
      // ...
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
export { authOptions };
