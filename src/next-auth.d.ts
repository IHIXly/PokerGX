import NextAuth from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    chips: number;
  }

  interface Session {
    user: {
      id: string;
      chips: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    chips: number;
  }
}
