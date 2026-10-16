import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { createAccount, findUserByEmail } from "@/lib/accounts";
import { audit } from "@/lib/audit";
import { LOCALES, type Locale } from "@/lib/format";
import { clearLimit, clientIp, hit, limited, LIMITS } from "@/lib/rate-limit";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

// Compared against when the email is unknown, so both paths take the same time.
const DUMMY_HASH = "$2b$12$VXRRhLcbNzh0E39TfTdTK.gbdbkprcFSH2cZ9ZfxXxkmWkKKxyiYS";

/** Clears the failed-sign-in counter, e.g. after a password reset. */
export async function clearFailures(email: string) {
  await clearLimit(`login:${email.trim().toLowerCase()}`);
}

export class TooManyAttempts extends CredentialsSignin {
  code = "too_many";
}

declare module "next-auth" {
  interface User {
    sessionVersion?: number;
  }
  interface Session {
    sessionVersion?: number;
  }
}
declare module "@auth/core/jwt" {
  interface JWT {
    sv?: number;
  }
}

/** Google is offered only when its keys are set (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET). */
export const googleEnabled = () => Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

/**
 * Google proves the address, so it may sign into the account with that email. An account whose
 * email was never confirmed loses its password first: whoever registered it may not own the inbox.
 */
async function googleUser(email: string, name: string) {
  const existing = await findUserByEmail(email);
  if (existing) {
    if (existing.emailVerifiedAt) return existing;
    const [updated] = await db
      .update(users)
      .set({
        emailVerifiedAt: new Date(),
        passwordHash: null,
        sessionVersion: sql`${users.sessionVersion} + 1`,
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated!;
  }
  const raw = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale: Locale = (LOCALES as readonly string[]).includes(raw ?? "") ? (raw as Locale) : "fr";
  const { userId } = await createAccount({
    name,
    email,
    passwordHash: null,
    workspaceName: name,
    locale,
    verified: true,
  });
  return (await findUserByEmail(email)) ?? { id: userId, sessionVersion: 0 };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(input) {
        const parsed = credentials.safeParse(input);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        // Per IP (password spraying across accounts) and per email (guessing one account).
        if ((await hit(`login-ip:${await clientIp()}`, LIMITS.loginAttemptsPerIp)) > LIMITS.loginAttemptsPerIp.max) {
          throw new TooManyAttempts();
        }
        if (await limited(`login:${email}`, LIMITS.loginFailuresPerEmail)) throw new TooManyAttempts();
        const [user] = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            hash: users.passwordHash,
            sessionVersion: users.sessionVersion,
          })
          .from(users)
          .where(eq(sql`lower(${users.email})`, email))
          .limit(1);
        const ok = await bcrypt.compare(password, user?.hash ?? DUMMY_HASH);
        if (!user?.hash || !ok) {
          await hit(`login:${email}`, LIMITS.loginFailuresPerEmail);
          await audit("auth.sign_in_failed", { actorId: user?.id, meta: { email } });
          return null;
        }
        await clearLimit(`login:${email}`);
        await audit("auth.sign_in", { actorId: user.id, meta: { method: "password" } });
        return { id: user.id, email: user.email, name: user.name, sessionVersion: user.sessionVersion };
      },
    }),
    ...(googleEnabled() ? [Google] : []),
  ],
  callbacks: {
    signIn({ account, profile }) {
      if (account?.provider === "google") return Boolean(profile?.email && profile.email_verified);
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        const u = await googleUser(profile.email.toLowerCase(), profile.name ?? profile.email.split("@")[0]!);
        token.sub = u.id;
        token.sv = u.sessionVersion;
        await audit("auth.sign_in", { actorId: u.id, meta: { method: "google" } });
      } else if (user?.id) {
        token.sub = user.id;
        token.sv = user.sessionVersion ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.sessionVersion = token.sv ?? 0;
      return session;
    },
  },
});
