export const runtime = "nodejs";

import { auth } from "@/server/auth"; // 👈 das importiert deine Auth-Funktion aus src/server/auth/index.ts

export default auth((req) => {
  // Wenn der User nicht eingeloggt ist, wird automatisch auf /login weitergeleitet,
  // weil wir das in authConfig.pages festlegen.
});

export const config = {
  matcher: ["/"], // schützt die Startseite ("/")
};
