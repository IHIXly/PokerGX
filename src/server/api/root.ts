import { createTRPCRouter } from "@/server/api/trpc";
import { pokerRouter } from "./routers/poker";

export const appRouter = createTRPCRouter({
  poker: pokerRouter,
});
