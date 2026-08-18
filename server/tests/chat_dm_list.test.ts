import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Response-shape cover for the second half of #324.2.
 *
 * Fixing the 404 on the DM list was necessary but not sufficient: the client
 * titles each conversation from `partner.username`, and `username` is empty
 * for every seeded and invited account — only self-signup generates one. So a
 * DM list that finally loaded would still have rendered a column of blank
 * rows. The route now also returns `partner.name`.
 *
 * chat_api_contract.test.ts guards the PATH. This guards the PAYLOAD.
 */

const { mockStorage } = vi.hoisted(() => ({
  mockStorage: {
    getDMsByUser: vi.fn(),
    getUser: vi.fn(),
    getChannel: vi.fn(),
    getMessagesByChannel: vi.fn(),
    getOrCreateDMChannel: vi.fn(),
  },
}));

vi.mock("../storage", () => ({ storage: mockStorage }));

// authenticateToken is exercised by the auth suite; here it stands in as the
// thing that has already established who the caller is.
vi.mock("../middleware", () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.session = { userId: 1 };
    next();
  },
  requireVerifiedEmail: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../lib/db/pg-queries", () => ({
  pgFindWorkspaceMembership: vi.fn(),
  pgFindWorkspaceById: vi.fn(),
  pgCreateWorkspaceInvite: vi.fn(),
}));
vi.mock("../lib/integrations/mailer", () => ({ sendWorkspaceInvite: vi.fn() }));
vi.mock("../lib/audit", () => ({ recordAuditEvent: vi.fn(), AUDIT_EVENTS: {} }));
vi.mock("../db-pg", () => ({ isPgReady: () => false, getPgPool: () => null }));
vi.mock("../lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import chatRouter from "../routes/chat";

const app = express();
app.use(express.json());
app.use("/api", chatRouter);

/** A DM channel as stored: the name encodes both participant ids. */
const dmChannel = { id: 7, name: "dm_1_2", type: "dm" };

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getDMsByUser.mockResolvedValue([dmChannel]);
});

describe("#324.2 — the DM list carries a displayable partner name", () => {
  it("returns partner.name so the conversation title is not blank", async () => {
    // The shape that broke it: an invited teacher, no username ever generated.
    mockStorage.getUser.mockResolvedValue({
      id: 2,
      username: "",
      name: "Priya Sharma",
      avatar: null,
      role: "teacher",
    });

    const res = await request(app).get("/api/users/me/dms");

    expect(res.status).toBe(200);
    expect(res.body[0].partner.name).toBe("Priya Sharma");
  });

  it("still returns username, so existing consumers are untouched", async () => {
    mockStorage.getUser.mockResolvedValue({
      id: 2,
      username: "priya",
      name: "Priya Sharma",
      avatar: null,
      role: "teacher",
    });

    const res = await request(app).get("/api/users/me/dms");

    expect(res.body[0].partner.username).toBe("priya");
    expect(res.body[0].partner.name).toBe("Priya Sharma");
  });

  it("falls back to username when the account has no display name", async () => {
    mockStorage.getUser.mockResolvedValue({
      id: 2,
      username: "priya",
      name: null,
      avatar: null,
      role: "teacher",
    });

    const res = await request(app).get("/api/users/me/dms");

    expect(res.body[0].partner.name).toBe("priya");
  });

  it("resolves the partner as the other participant, not the caller", async () => {
    mockStorage.getUser.mockResolvedValue({
      id: 2,
      username: "",
      name: "Priya Sharma",
      avatar: null,
      role: "teacher",
    });

    await request(app).get("/api/users/me/dms");

    // Caller is user 1 in the "dm_1_2" channel, so the lookup must be user 2.
    expect(mockStorage.getUser).toHaveBeenCalledWith(2);
  });

  it("passes the channel through unenriched when the partner is gone", async () => {
    // A deleted account must not 500 the whole list for the other party.
    mockStorage.getUser.mockResolvedValue(null);

    const res = await request(app).get("/api/users/me/dms");

    expect(res.status).toBe(200);
    expect(res.body[0].partner).toBeUndefined();
    expect(res.body[0].id).toBe(7);
  });
});

/**
 * Route-level proof that the repaired DM surface denies non-participants.
 * The helper has its own unit tests; these assert the wiring, because the bugs
 * that shipped were all in the wiring rather than in any shared predicate
 * (there wasn't one).
 *
 * Caller is user 1 throughout. `dm_10_20` is a conversation between two other
 * people that the old substring check let user 1 read.
 */
describe("#324.2 — DM routes deny non-participants", () => {
  const strangersDm = { id: 42, name: "dm_10_20", type: "dm", workspaceId: null };
  const ownDm = { id: 7, name: "dm_1_2", type: "dm", workspaceId: null };

  it("refuses history for a conversation the caller is not in", async () => {
    mockStorage.getChannel.mockResolvedValue(strangersDm);

    const res = await request(app).get("/api/messages/42");

    expect(res.status).toBe(403);
    expect(mockStorage.getMessagesByChannel).not.toHaveBeenCalled();
  });

  it("refuses it on the channels route the client actually uses too", async () => {
    mockStorage.getChannel.mockResolvedValue(strangersDm);

    const res = await request(app).get("/api/channels/42/messages");

    expect(res.status).toBe(403);
    expect(mockStorage.getMessagesByChannel).not.toHaveBeenCalled();
  });

  it("serves history for the caller's own DM on the client's route", async () => {
    // Regression for the other half: DM channels have no workspace_id, so this
    // route used to 403 every conversation the list could show.
    mockStorage.getChannel.mockResolvedValue(ownDm);
    mockStorage.getMessagesByChannel.mockResolvedValue([{ id: 1, content: "hi" }]);

    const res = await request(app).get("/api/channels/7/messages");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("refuses to mint a DM channel between two other users", async () => {
    const res = await request(app)
      .post("/api/channels/dm")
      .send({ userIds: [10, 20] });

    expect(res.status).toBe(403);
    expect(mockStorage.getOrCreateDMChannel).not.toHaveBeenCalled();
  });

  it("allows the caller to open their own DM channel", async () => {
    mockStorage.getOrCreateDMChannel.mockResolvedValue(ownDm);

    const res = await request(app)
      .post("/api/channels/dm")
      .send({ userIds: [1, 2] });

    expect(res.status).toBe(200);
    expect(mockStorage.getOrCreateDMChannel).toHaveBeenCalledWith(1, 2);
  });
});
