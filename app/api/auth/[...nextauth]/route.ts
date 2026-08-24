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
        console.log("=== JWT Callback - New User ===");
        console.log("User:", user.id, user.email);
        token.sub = user.id;
      }
      return token;
    },
  },
  events: {
    async createUser({ user }: { user: any }) {
      console.log("✅ Creating user:", user.email, "id:", user.id);
      try {
        await prisma.user.create({
          data: {
            id: user.id!,
            email: user.email!,
            name: user.name,
            image: user.image,
          },
        });
        console.log("✅ User created successfully");
      } catch (err) {
        console.error("❌ Error creating user:", err);
      }
    },
  },
};

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user }: { user: any }) {
      console.log("=== SIGN IN ===");
      console.log("User:", user.id, user.email);
      
      try {
        // Check if user exists
        const existing = await prisma.user.findUnique({
          where: { email: user.email! },
        });
        
        if (!existing) {
          console.log("Creating new user...");
          await prisma.user.create({
            data: {
              id: user.id!,
              email: user.email!,
              name: user.name,
              image: user.image,
            },
          });
          console.log("User created!");
        } else {
          console.log("User already exists:", existing.email);
        }
      } catch (err: any) {
        console.error("Error:", err.message);
      }
      
      return true;  // Allow sign in
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session?.user) {
        // @ts-ignore
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
});

export { handler as GET, handler as POST };
export { authOptions };

