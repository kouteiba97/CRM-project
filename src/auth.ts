import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

// Compared against when the email is unknown, so both paths take the same time.
const DUMMY_HASH = "$2b$12$VXRRhLcbNzh0E39TfTdTK.gbdbkprcFSH2cZ9ZfxXxkmWkKKxyiYS";

// Per-email failure counter: 5 wrong passwords lock that email for 15 minutes (per server).
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, { count: number; first: number }>();

function locked(email: string) {
  const f = failures.get(email);
  if (!f) return false;
  if (Date.now() - f.first > WINDOW_MS) {
    failures.delete(email);
    return false;
  }
  return f.count >= MAX_FAILURES;
}

function recordFailure(email: string) {
  const f = failures.get(email);
  if (!f || Date.now() - f.first > WINDOW_MS) failures.set(email, { count: 1, first: Date.now() });
  else f.count += 1;
}

export class TooManyAttempts extends CredentialsSignin {
  code = "too_many";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(input) {
        const parsed = credentials.safeParse(input);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        if (locked(email)) throw new TooManyAttempts();
        const [user] = await db
          .select({ id: users.id, email: users.email, name: users.name, hash: users.passwordHash })
          .from(users)
          .where(eq(sql`lower(${users.email})`, email))
          .limit(1);
        const ok = await bcrypt.compare(password, user?.hash ?? DUMMY_HASH);
        if (!user?.hash || !ok) {
          recordFailure(email);
          return null;
        }
        failures.delete(email);
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
