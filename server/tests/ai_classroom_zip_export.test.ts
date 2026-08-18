import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const _require = createRequire(import.meta.url);

/**
 * `GET /api/ai-classroom/export/:classroomId/zip` threw
 * `TypeError: archiver is not a function` on every request.
 *
 * archiver 8 removed the callable factory export. package.json had been on
 * archiver ^8.0.0 while @types/archiver stayed on ^7.0.0, and the v7 types
 * still described a callable default — so the call site typechecked cleanly
 * against types that no longer matched the installed runtime, and nothing
 * failed until a real request hit the route.
 *
 * These assert against the RUNTIME module, not its types, because agreeing
 * with the types is exactly what hid the bug.
 */
describe("archiver 8 runtime contract (ZIP export)", () => {
  const archiverModule = _require("archiver");

  it("no longer exposes a callable factory — the shape the old call site assumed", () => {
    expect(typeof archiverModule).not.toBe("function");
    expect(typeof archiverModule.default).not.toBe("function");
  });

  it("exposes ZipArchive, which is what the route now constructs", () => {
    expect(typeof archiverModule.ZipArchive).toBe("function");
  });

  it("builds a working archive with the options the route passes", () => {
    const archive = new archiverModule.ZipArchive({ zlib: { level: 6 } });

    expect(typeof archive.append).toBe("function");
    expect(typeof archive.pipe).toBe("function");
    expect(typeof archive.finalize).toBe("function");
    expect(typeof archive.on).toBe("function");
  });

  it("actually produces zip bytes through the route's exact call sequence", async () => {
    const { PassThrough } = await import("stream");
    const archive = new archiverModule.ZipArchive({ zlib: { level: 6 } });
    const sink = new PassThrough();
    const chunks: Buffer[] = [];
    sink.on("data", (c: Buffer) => chunks.push(c));

    const done = new Promise<void>((resolve, reject) => {
      sink.on("end", () => resolve());
      archive.on("error", reject);
    });

    archive.pipe(sink);
    archive.append("<html></html>", { name: "classroom.html" });
    archive.append(JSON.stringify({ ok: true }), { name: "classroom-data.json" });
    archive.finalize();
    await done;

    const out = Buffer.concat(chunks);
    expect(out.length).toBeGreaterThan(0);
    // Local file header magic — proves a real zip, not an empty stream.
    expect(out.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});
