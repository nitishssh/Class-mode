import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { storage } from "../storage";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  isAlive: boolean;
}

export function setupGateway(server: Server) {
  const wss = new WebSocketServer({ server, path: "/gateway" });

  wss.on("connection", (ws: AuthenticatedWebSocket) => {
    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (data) => {
      try {
        const payload = JSON.parse(data.toString());

        switch (payload.op) {
          case "IDENTIFY":
            // In a real app, we'd verify a JWT here.
            // For now, we'll trust the userId if provided (dev mode)
            if (payload.d && payload.d.userId) {
              const userId = payload.d.userId;
              ws.userId = userId;
              console.log(`User ${userId} identified on gateway`);

              // Send READY event
              const guilds = await storage.getWorkspaces(userId);
              ws.send(
                JSON.stringify({
                  t: "READY",
                  d: {
                    user: await storage.getUser(userId),
                    guilds,
                  },
                })
              );
            }
            break;

          case "HEARTBEAT":
            ws.send(JSON.stringify({ op: "HEARTBEAT_ACK" }));
            break;
        }
      } catch (err) {
        console.error("Gateway message error:", err);
      }
    });
  });

  // Heartbeat interval
  const interval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  return wss;
}

// Helper to broadcast to specific users (members of a guild/channel)
export function broadcastToGuild(wss: WebSocketServer, guildId: string, event: string, data: any) {
  wss.clients.forEach(async (client: any) => {
    if (client.readyState === WebSocket.OPEN && client.userId) {
      const ws = await storage.getWorkspace(Number(guildId));
      const isMember = ws?.members?.includes(client.userId) ?? false;
      if (isMember) {
        client.send(JSON.stringify({ t: event, d: data }));
      }
    }
  });
}
