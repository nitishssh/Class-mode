import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: number;
    username?: string; // optional — not always populated by createLoginSession
    role: string;
    email?: string; // optional — not always populated by createLoginSession
    firebaseUid?: string;
  }
}

// Augment the core Request interface that all parameterised overloads extend.
// Using express-serve-static-core ensures `req.user` is visible on
// Request<Params, ResBody, ReqBody, Query> as well as the plain Request.
declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: number;
      role?: string;
      email?: string;
      [key: string]: unknown;
    };
  }
}
