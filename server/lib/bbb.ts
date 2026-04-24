import crypto from "crypto";
import querystring from "querystring";

const BBB_URL =
  process.env.BBB_URL || "https://test-install.blindsidenetworks.com/bigbluebutton/api";
const BBB_SECRET = process.env.BBB_SECRET || "8cd8ef52e8e101574e400365b55e11a6";

// Helper to calculate BBB checksum
function calculateChecksum(callName: string, queryParams: string): string {
  return crypto.createHash("sha1").update(`${callName}${queryParams}${BBB_SECRET}`).digest("hex");
}

export function getJoinUrl(
  meetingId: string,
  fullName: string,
  password?: string,
  joinAs: "moderator" | "attendee" = "attendee"
): string {
  const params: Record<string, string> = {
    fullName,
    meetingID: meetingId,
  };

  if (password) {
    params.password = password;
  }

  const queryParams = querystring.stringify(params);
  const checksum = calculateChecksum("join", queryParams);

  return `${BBB_URL}/join?${queryParams}&checksum=${checksum}`;
}

export async function createMeeting(
  meetingId: string,
  name: string,
  attendeePW: string,
  moderatorPW: string,
  welcomeMsg: string = "Welcome to the live class!"
): Promise<any> {
  const params = {
    meetingID: meetingId,
    name,
    attendeePW,
    moderatorPW,
    welcome: welcomeMsg,
    record: "true",
    autoStartRecording: "true",
    allowStartStopRecording: "true",
  };

  const queryParams = querystring.stringify(params);
  const checksum = calculateChecksum("create", queryParams);

  const url = `${BBB_URL}/create?${queryParams}&checksum=${checksum}`;

  try {
    const response = await fetch(url);
    const text = await response.text();
    // In a real production scenario, use a proper XML parser.
    // Here we'll do a simple regex check to see if it succeeded.
    if (text.includes("<returncode>SUCCESS</returncode>")) {
      return { success: true, message: "Meeting created successfully", xml: text };
    } else {
      console.error("BBB Create Meeting failed:", text);
      return { success: false, message: "Failed to create meeting", xml: text };
    }
  } catch (err) {
    console.error("BBB Create Meeting error:", err);
    return { success: false, message: "Error calling BBB server" };
  }
}
