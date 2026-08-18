import { describe, it, expect } from "vitest";
import { parseDmParticipants, isDmParticipant, dmChannelName } from "../lib/chat/dm-channel";

/**
 * The DM authorization checks that #324.2 made reachable.
 *
 * Fixing the 404 turned three latent bugs into live ones. Each had its own
 * wrong idea of what "is this user in this conversation" means, and each is
 * pinned here with the exact input that defeated it.
 */

describe("DM participant identity", () => {
  it("accepts both real participants", () => {
    expect(isDmParticipant("dm_1_2", 1)).toBe(true);
    expect(isDmParticipant("dm_1_2", 2)).toBe(true);
  });

  it("rejects a user who is not in the conversation", () => {
    expect(isDmParticipant("dm_1_2", 3)).toBe(false);
  });

  // The substring bug: `"dm_10_20".includes("1")` is true.
  it("rejects a prefix-substring impostor (the .includes bug)", () => {
    expect(isDmParticipant("dm_10_20", 1)).toBe(false);
    expect(isDmParticipant("dm_10_20", 2)).toBe(false);
    expect(isDmParticipant("dm_10_20", 0)).toBe(false);
  });

  it("still admits the real participants of that same channel", () => {
    expect(isDmParticipant("dm_10_20", 10)).toBe(true);
    expect(isDmParticipant("dm_10_20", 20)).toBe(true);
  });

  // The separator bug: names use "_", the checks split on "-".
  it("parses underscore-separated names, which is what storage writes", () => {
    expect(parseDmParticipants("dm_1_2")).toEqual([1, 2]);
    expect(dmChannelName(2, 1)).toBe("dm_1_2");
  });

  it("treats an unparseable name as nobody's conversation, never everybody's", () => {
    for (const bad of ["dm-1-2", "dm_", "dm_a_b", "channel_1_2", "", "dm_1_2_3", "dm_1"]) {
      expect(isDmParticipant(bad, 1)).toBe(false);
      expect(parseDmParticipants(bad)).toBeNull();
    }
  });

  it("canonicalises so the same pair always resolves to one channel", () => {
    expect(dmChannelName(7, 3)).toBe(dmChannelName(3, 7));
    expect(isDmParticipant(dmChannelName(7, 3), 7)).toBe(true);
    expect(isDmParticipant(dmChannelName(7, 3), 3)).toBe(true);
  });
});

/**
 * The SQL half. `_` is a single-character wildcard in LIKE, so the old
 * `dm_${id}_%` pattern matched other people's channels. This models both the
 * broken pattern and the shipped replacement against the same channel set, so
 * the leak is visible rather than argued about.
 */
describe("DM list scoping (the LIKE wildcard leak)", () => {
  const channels = ["dm_2_3", "dm_20_30", "dm_1_2", "dm_11_2", "dm_2_100"];

  /** Faithful model of SQL LIKE: `_` = any one char, `%` = any run. */
  const likeMatches = (pattern: string, value: string) => {
    const rx = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/_/g, ".")
      .replace(/%/g, ".*");
    return new RegExp(`^${rx}$`).test(value);
  };

  /** Faithful model of the shipped split_part comparison. */
  const splitPartMatches = (userId: number, name: string) => {
    const parts = name.split("_");
    return parts[1] === String(userId) || parts[2] === String(userId);
  };

  it("reproduces the leak: the old patterns returned strangers' channels", () => {
    const leaked = channels.filter((c) => likeMatches("dm_2_%", c) || likeMatches("dm_%_2", c));

    // dm_20_30 is a conversation between users 20 and 30. User 2 is not in it.
    expect(leaked).toContain("dm_20_30");
  });

  it("the shipped query returns only conversations the user is actually in", () => {
    const scoped = channels.filter((c) => splitPartMatches(2, c));

    // dm_11_2 belongs here: it is a real conversation between users 11 and 2.
    // Only dm_20_30 — two strangers — must be absent.
    expect(scoped.sort()).toEqual(["dm_1_2", "dm_11_2", "dm_2_100", "dm_2_3"].sort());
    expect(scoped).not.toContain("dm_20_30");
  });

  it("agrees with the participant check used by every other DM route", () => {
    for (const c of channels) {
      expect(splitPartMatches(2, c)).toBe(isDmParticipant(c, 2));
    }
  });
});
