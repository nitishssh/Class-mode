import ChatLayout from "@/components/chat/ChatLayout";

/**
 * Messages page — renders the full-screen chat layout.
 * The ChatLayout wraps itself with ChatRoleProvider (Firebase auth-backed),
 * so no extra context setup is needed here.
 */
export default function MessagesPage() {
  return (
    <div className="flex h-full flex-col">
      <ChatLayout />
    </div>
  );
}
