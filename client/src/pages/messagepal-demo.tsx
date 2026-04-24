import { MessagePanel } from "@/components/message/messagepal-panel";

export default function MessagePage() {
  return (
    <div className="flex h-screen flex-col">
      <header className="border-b p-4">
        <h1 className="text-2xl font-bold">MessagePal - Real-time Messaging</h1>
        <p className="text-muted-foreground">
          Secure, fast messaging for educational communication
        </p>
      </header>

      <main className="flex-1">
        <MessagePanel />
      </main>
    </div>
  );
}
