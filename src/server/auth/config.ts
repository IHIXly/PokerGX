import { PrismaAdapter } from "@auth/prisma-adapter";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GitHubProvider from "next-auth/providers/github"; // 👈 hinzugefügt

import CredentialsProvider from "next-auth/providers/credentials"; //Für Gast login
import { randomUUID } from "crypto";

import { db } from "@/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
	interface Session extends DefaultSession {
		user: {
			id: string;
			chips:number;
			// ...other properties
			// role: UserRole;
		} & DefaultSession["user"];
	}

}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    DiscordProvider,
    GitHubProvider,
    CredentialsProvider({
  name: "Guest Login",
  credentials: {},
  async authorize() {
    const user = await db.user.create({
      data: {
        name: `Guest_${Math.floor(Math.random() * 10000)}`,
        email: `guest_${crypto.randomUUID()}@poker.local`,
        chips: 1000,
        image: "./Guest.png"
      },
    });
     return {
      id: user.id,
      name: user.name,
      email: user.email,
      chips: user.chips,
    };
  },
    }),
  ],
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt", // ⚡ wichtig!
  },
  pages: {
    signIn: "/login", // 👈 schickt nicht eingeloggte User zur Login-Seite
  },
  callbacks: {
    // ⚙️ JWT Callback: Wird jedes Mal beim Token-Erstellen oder Aktualisieren aufgerufen
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.chips = user.chips ?? 1000;
      }
      return token;
    },

    // ⚙️ Session Callback: Baut das Session-Objekt, das du im Frontend bekommst
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.chips = token.chips as number;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
