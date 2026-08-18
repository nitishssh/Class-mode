import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import chatRouter from "../routes/chat";

/**
 * Contract guard between the messaging client and the chat router.
 *
 * #324.2: `client/src/lib/chat-api.ts` called `/chat/dms` for the DM list.
 * The server has never registered that path — the route is `/users/me/dms`.
 * Every request 404'd, the react-query call failed quietly, and the DM list
 * rendered empty for every user with no error surfaced. Nothing failed in CI,
 * because no test crosses the client/server boundary.
 *
 * This reads the real route table off the express router (not a regex over the
 * source) and checks that every path the client asks for is actually served.
 */

const CLIENT_API = path.resolve(process.cwd(), "client/src/lib/chat-api.ts");
const BASE = "/api";
const MOUNT = "/api"; // server/routes/index.ts: app.use("/api", chatRouter)

interface RegisteredRoute {
  method: string;
  path: string;
}

/** Every route the chat router actually serves. */
function registeredRoutes(): RegisteredRoute[] {
  const stack = (chatRouter as unknown as { stack: any[] }).stack ?? [];
  const routes: RegisteredRoute[] = [];
  for (const layer of stack) {
    if (!layer.route?.path) continue;
    const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
    for (const method of Object.keys(layer.route.methods ?? {})) {
      for (const p of paths) routes.push({ method: method.toUpperCase(), path: p });
    }
  }
  return routes;
}

/**
 * Paths the client requests, as written in chat-api.ts. Template literals have
 * their `${...}` holes replaced with a placeholder segment, and query strings
 * dropped — neither affects which route express matches.
 */
function clientPaths(): string[] {
  const src = readFileSync(CLIENT_API, "utf8");
  const found = new Set<string>();
  for (const [, raw] of src.matchAll(/apiFetch<[^>]*>\(\s*[`"]([^`"]+)[`"]/g)) {
    found.add(
      raw
        .replace(/\$\{[^}]*\}/g, "__param__")
        .split("?")[0]
        .trim()
    );
  }
  return [...found];
}

/** Does an express route pattern match a concrete request path? */
function matches(routePath: string, requestPath: string): boolean {
  const routeParts = routePath.split("/").filter(Boolean);
  const reqParts = requestPath.split("/").filter(Boolean);
  if (routeParts.length !== reqParts.length) return false;
  return routeParts.every((part, i) => part.startsWith(":") || part === reqParts[i]);
}

describe("#324.2 — every chat-api path is served by the chat router", () => {
  it("finds routes on the router and paths in the client (guard is wired up)", () => {
    // If either side comes back empty the checks below pass vacuously, which
    // is exactly how a broken guard reports safety it doesn't provide.
    expect(registeredRoutes().length).toBeGreaterThan(10);
    expect(clientPaths().length).toBeGreaterThan(3);
  });

  it("serves every path client/src/lib/chat-api.ts requests", () => {
    const routes = registeredRoutes();
    const unmatched = clientPaths().filter(
      (clientPath) => !routes.some((r) => matches(MOUNT + r.path, BASE + clientPath))
    );

    expect(
      unmatched,
      `chat-api.ts calls ${unmatched.map((p) => BASE + p).join(", ")}, which the chat router does not serve. ` +
        `Registered: ${routes.map((r) => `${r.method} ${MOUNT}${r.path}`).join(", ")}`
    ).toEqual([]);
  });

  it("still catches the exact path that 404'd in production", () => {
    // Pins the guard itself: /chat/dms must not resolve, /users/me/dms must.
    const routes = registeredRoutes();
    const resolves = (p: string) => routes.some((r) => matches(MOUNT + r.path, BASE + p));

    expect(resolves("/chat/dms")).toBe(false);
    expect(resolves("/users/me/dms")).toBe(true);
  });
});
