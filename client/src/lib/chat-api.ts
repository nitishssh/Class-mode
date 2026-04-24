/**
 * client/src/lib/chat-api.ts  — Phase 5.1
 *
 * REST API client for the messaging feature.
 * All calls include credentials: 'include' so the session cookie is sent.
 */

import { Conversation, Message } from "@/types/chat";

const BASE = "/api";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ApiWorkspace {
  id: number;
  name: string;
  slug: string;
}

export interface ApiChannel {
  id: number;
  name: string;
  type: "channel" | "dm" | "announcement";
  subject?: string;
  class?: string;
  partner?: {
    id: number;
    username: string;
    role: string;
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `API error ${res.status}`);
  }
  return res.json();
}

/** Fetch all conversations (channels) accessible to the logged-in user. */
export async function getConversations(): Promise<Conversation[]> {
  return apiFetch<Conversation[]>("/chat/conversations");
}

/**
 * Fetch paginated message history for a channel.
 * @param channelId  MongoDB channel integer ID
 * @param limit      max messages to return (default 50)
 * @param before     message ID cursor — return messages older than this
 */
export async function getMessages(
  channelId: number | string,
  limit = 50,
  before?: number
): Promise<Message[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set("before", String(before));
  return apiFetch<Message[]>(`/channels/${channelId}/messages?${params}`);
}

/** Mark all messages in a conversation as read. */
export async function markConversationRead(channelId: number | string): Promise<void> {
  await apiFetch(`/chat/conversations/${channelId}/read`, { method: "POST" });
}

/** Send a message via HTTP (fallback when WS not connected). */
export async function sendMessageHttp(
  channelId: number | string,
  content: string,
  messageType: string = "text"
): Promise<Message> {
  return apiFetch<Message>("/messages", {
    method: "POST",
    body: JSON.stringify({ channelId: Number(channelId), content, messageType }),
  });
}

// ─── Workspace / Channel / DM helpers ────────────────────────────────────────

/** Fetch all workspaces the current user belongs to. */
export async function fetchWorkspaces(): Promise<ApiWorkspace[]> {
  return apiFetch<ApiWorkspace[]>("/workspaces");
}

/** Fetch all channels for a given workspace. */
export async function fetchChannels(workspaceId: number): Promise<ApiChannel[]> {
  return apiFetch<ApiChannel[]>(`/workspaces/${workspaceId}/channels`);
}

/** Fetch all DM conversations for the current user. */
export async function fetchDMs(): Promise<ApiChannel[]> {
  return apiFetch<ApiChannel[]>("/chat/dms");
}

/**
 * Alias for getMessages — fetch paginated message history for a channel.
 * @param channelId  Channel ID
 * @param limit      Max messages to return (default 50)
 * @param before     Message ID cursor — return messages older than this
 */
export async function fetchMessages(
  channelId: number | string,
  limit = 50,
  before?: number
): Promise<Message[]> {
  return getMessages(channelId, limit, before);
}

// ─── File upload ──────────────────────────────────────────────────────────────

export interface UploadResult {
  url: string;
  name: string;
  mimeType: string;
}

/**
 * Upload a file to the server and return its URL + original name.
 */
export async function uploadFile(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE}/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Upload error ${res.status}`);
  }
  return res.json();
}
