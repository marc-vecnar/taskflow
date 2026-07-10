// Augments Express's Request with the authenticated user attached by requireAuth.
import type { AuthUser } from "../lib/types.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
