import NextAuth from "next-auth";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
	interface User {
		id: string;
		chips: number;
		wallet: number;
	}

	interface Session {
		user: {
			id: string;
			chips: number;
			wallet: number;
		} & DefaultSession["user"];
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		id: string;
		chips: number;
		wallet: number;
	}
}
