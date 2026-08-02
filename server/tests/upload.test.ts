// File upload route (POST /api/upload) and its multer security filter.
// The filter is the security boundary: uploaded files are later served by
// express.static, which infers Content-Type from extension — so an .html or
// .svg slipping through would execute as stored XSS. These tests prove the
// dangerous cases are rejected (and write nothing to disk, since the filter
// runs before storage) and that diskPathToUrl never leaks an absolute path.

import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import path from "path";

const h = vi.hoisted(() => ({ currentUser: null as any }));

vi.mock("../middleware", () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    if (!h.currentUser) return res.status(401).json({ message: "unauthorized" });
    req.user = h.currentUser;
    next();
  },
}));

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import uploadRouter from "../routes/upload";
import { diskPathToUrl } from "../lib/integrations/upload";

function makeApp() {
  const app = express();
  app.use("/api/upload", uploadRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.currentUser = { id: 7 };
});

describe("POST /api/upload — auth & presence", () => {
  it("401s when unauthenticated (multer never runs)", async () => {
    h.currentUser = null;
    const res = await request(makeApp())
      .post("/api/upload")
      .attach("file", Buffer.from("hello"), { filename: "note.txt", contentType: "text/plain" });
    expect(res.status).toBe(401);
  });

  it("400s when no file field is present", async () => {
    const res = await request(makeApp()).post("/api/upload").field("other", "x");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no file/i);
  });
});

describe("POST /api/upload — filter rejects dangerous files", () => {
  // A rejected file returns no url and is never stored. Status may be 4xx/5xx
  // depending on multer error propagation; the security assertion is "not
  // accepted, no url handed back".
  const expectRejected = (res: request.Response) => {
    expect(res.status).not.toBe(200);
    expect(res.body?.url).toBeUndefined();
  };

  it("rejects an HTML file (stored-XSS vector) by MIME", async () => {
    const res = await request(makeApp())
      .post("/api/upload")
      .attach("file", Buffer.from("<script>alert(1)</script>"), {
        filename: "evil.html",
        contentType: "text/html",
      });
    expectRejected(res);
  });

  it("rejects an executable disguised with a disallowed MIME", async () => {
    const res = await request(makeApp()).post("/api/upload").attach("file", Buffer.from("MZ..."), {
      filename: "payload.exe",
      contentType: "application/x-msdownload",
    });
    expectRejected(res);
  });

  it("rejects MIME-spoofing: allowed image MIME but a disallowed extension", async () => {
    // Extension allowlist is the second guard: a client can claim image/png
    // while shipping a .svg (which can carry inline script).
    const res = await request(makeApp())
      .post("/api/upload")
      .attach("file", Buffer.from("<svg onload=alert(1)>"), {
        filename: "sneaky.svg",
        contentType: "image/png",
      });
    expectRejected(res);
  });
});

describe("diskPathToUrl", () => {
  it("maps a public/uploads disk path to a rooted web url", () => {
    const abs = path.resolve("public", "uploads", "2025-01-01", "photo.png");
    expect(diskPathToUrl(abs)).toBe("/uploads/2025-01-01/photo.png");
  });

  it("returns a relative, web-rooted path — never the absolute disk path", () => {
    const abs = path.resolve("public", "uploads", "2025-01-01", "doc.pdf");
    const url = diskPathToUrl(abs);
    expect(url.startsWith("/uploads/")).toBe(true);
    expect(path.isAbsolute(url.slice(1))).toBe(false);
    expect(url).not.toContain(process.cwd());
  });
});
