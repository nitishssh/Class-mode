import axios from "axios";

const DAILY_API_URL = "https://api.daily.co/v1";
const DAILY_API_KEY = process.env.DAILY_API_KEY;

if (!DAILY_API_KEY && process.env.NODE_ENV !== "test") {
  console.warn("DAILY_API_KEY is not set. Live classes will not work.");
}

const dailyClient = axios.create({
  baseURL: DAILY_API_URL,
  headers: {
    Authorization: `Bearer ${DAILY_API_KEY}`,
    "Content-Type": "application/json",
  },
});

export interface CreateRoomOptions {
  name?: string;
  privacy?: "public" | "private";
  properties?: {
    nbf?: number; // Not before (Unix timestamp)
    exp?: number; // Expires (Unix timestamp)
    max_participants?: number;
    enable_knocking?: boolean;
    enable_screenshare?: boolean;
    enable_chat?: boolean;
    start_video_off?: boolean;
    start_audio_off?: boolean;
    owner_only_broadcast?: boolean;
    enable_recording?: "cloud" | "local" | "output-byte-stream" | "rtp-tracks";
  };
}

export const createRoom = async (options: CreateRoomOptions = {}) => {
  try {
    const defaultProperties = {
      enable_knocking: true, // Students must be accepted by teacher
      enable_screenshare: true,
      enable_chat: true,
      start_video_off: true,
      start_audio_off: true,
      enable_recording: "cloud",
      max_participants: 50,
    };

    const payload = {
      privacy: options.privacy || "private",
      properties: { ...defaultProperties, ...options.properties },
    };

    if (options.name) {
      Object.assign(payload, { name: options.name });
    }

    const response = await dailyClient.post("/rooms", payload);
    return response.data;
  } catch (error: any) {
    console.error("Error creating Daily room:", error.response?.data || error.message);
    throw new Error("Failed to create live class room");
  }
};

export const deleteRoom = async (roomName: string) => {
  try {
    const response = await dailyClient.delete(`/rooms/${roomName}`);
    return response.data;
  } catch (error: any) {
    console.error(`Error deleting Daily room ${roomName}:`, error.response?.data || error.message);
    throw new Error("Failed to delete live class room");
  }
};

export interface CreateTokenOptions {
  room_name: string;
  is_owner?: boolean;
  user_name?: string;
  user_id?: string;
  enable_recording?: "cloud" | "local" | "output-byte-stream" | "rtp-tracks";
}

export const createMeetingToken = async (options: CreateTokenOptions) => {
  try {
    const response = await dailyClient.post("/meeting-tokens", {
      properties: {
        room_name: options.room_name,
        is_owner: options.is_owner || false,
        user_name: options.user_name,
        user_id: options.user_id,
        enable_recording: options.is_owner ? "cloud" : undefined, // Only owners can start/stop recording usually
      },
    });
    return response.data.token;
  } catch (error: any) {
    console.error("Error creating Daily meeting token:", error.response?.data || error.message);
    throw new Error("Failed to generate connection token");
  }
};

export const getRecordings = async (roomName: string) => {
  try {
    const response = await dailyClient.get(`/recordings?room_name=${roomName}`);
    return response.data.data;
  } catch (error: any) {
    console.error(
      `Error fetching recordings for room ${roomName}:`,
      error.response?.data || error.message
    );
    throw new Error("Failed to fetch class recordings");
  }
};

export const getRecordingAccessLink = async (recordingId: string) => {
  try {
    const response = await dailyClient.get(`/recordings/${recordingId}/access-link`);
    return response.data.download_link;
  } catch (error: any) {
    console.error(
      `Error fetching access link for recording ${recordingId}:`,
      error.response?.data || error.message
    );
    throw new Error("Failed to get recording link");
  }
};
