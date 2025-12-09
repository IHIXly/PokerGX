import { handlers } from "@/server/auth"; 

// Exportiert die Auth.js-Handler (GET + POST) für alle Auth-Routen
export const { GET, POST } = handlers;
