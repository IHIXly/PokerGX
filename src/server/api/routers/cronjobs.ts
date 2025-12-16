import { api } from "@/trpc/react";

 const utils = api.useUtils();

 const terminateSessionForInactivity = api.poker.terminateSessionForInactivity.useMutation();

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24); // 24h

  if (secret !== process.env.CRON_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

    terminateSessionForInactivity.mutate();

  return new Response("OK");
}
