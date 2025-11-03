import { PrismaAdapter } from "@auth/prisma-adapter";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GitHubProvider from "next-auth/providers/github"; // 👈 hinzugefügt

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

	// interface User {
	//   // ...other properties
	//   // role: UserRole;
	// }
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
  ],
  adapter: PrismaAdapter(db),
  pages: {
    signIn: "/login", // 👈 schickt nicht eingeloggte User zur Login-Seite
  },
  callbacks: {
    session: async ({ session, user }) => {
      const prismaUser = await db.user.findUnique({ where: { id: user.id } });
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          chips: prismaUser?.chips ?? 0,
        },
      };
    },
  },
} satisfies NextAuthConfig;
