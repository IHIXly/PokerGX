// Not in use. Delete later if unnecessary.

export const runtime = "nodejs";

import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  const ctx = await createTRPCContext({ headers: req.headers });
  const caller = appRouter.createCaller(ctx);

  await caller.poker.terminateSessionForInactivity(); 
  // ^ Name ggf. an deinen Router/Procedure anpassen!

  return new Response("OK");
}
