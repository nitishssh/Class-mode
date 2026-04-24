import { WsStatus } from "@/hooks/use-chat-ws";
import { Wifi, WifiOff } from "lucide-react";

export function WsReconnectBanner({ status }: { status: WsStatus }) {
  if (status === "connected" || status === "idle") return null;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 text-xs font-medium ${
        status === "reconnecting" || status === "connecting"
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "bg-destructive/10 text-destructive"
      }`}
    >
      {status === "error" ? (
        <WifiOff className="h-3.5 w-3.5" />
      ) : (
        <Wifi className="h-3.5 w-3.5 animate-pulse" />
      )}
      {status === "reconnecting"
        ? "Reconnecting…"
        : status === "connecting"
          ? "Connecting…"
          : "Connection lost"}
    </div>
  );
}
