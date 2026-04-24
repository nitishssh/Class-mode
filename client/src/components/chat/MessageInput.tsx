import { useState, useRef, useCallback } from "react";
import { uploadFile } from "@/lib/chat-api";
import { Send, Paperclip, Smile, HelpCircle, FileText, AlertTriangle } from "lucide-react";
import { useRole } from "@/contexts/chat-role-context";

interface MessageInputProps {
  onSend: (content: string, type?: "text" | "doubt", fileUrl?: string) => void;
  onTyping?: () => void;
  isReadOnly?: boolean;
}

const MessageInput = ({ onSend, onTyping, isReadOnly }: MessageInputProps) => {
  const [text, setText] = useState("");
  const [doubtMode, setDoubtMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentRole } = useRole();

  // The original early return for readOnly mode violated hook rules because it came before useCallback hooks

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, doubtMode ? "doubt" : "text");
    setText("");
    setDoubtMode(false);
    inputRef.current?.focus();
  }, [text, doubtMode, onSend]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reset the input so the same file can be re-selected
      e.target.value = "";
      setUploading(true);
      try {
        const result = await uploadFile(file);
        // Send it as a message immediately
        onSend(result.name, "text", result.url);
      } catch (err) {
        console.error("[MessageInput] upload failed", err);
      } finally {
        setUploading(false);
      }
    },
    [onSend]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isReadOnly) {
    return (
      <div className="border-t border-border bg-card px-4 py-3">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">This is a read-only announcement channel</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card px-4 py-3">
      {/* Quick actions */}
      {(currentRole === "student" || currentRole === "teacher") && (
        <div className="mb-2 flex items-center gap-2">
          {currentRole === "student" && (
            <button
              onClick={() => setDoubtMode(!doubtMode)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                doubtMode
                  ? "bg-doubt text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Ask Doubt
            </button>
          )}
          {currentRole === "teacher" && (
            <button className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground transition-all hover:text-foreground">
              <FileText className="h-3.5 w-3.5" />
              Send Assignment
            </button>
          )}
        </div>
      )}

      {doubtMode && (
        <div className="mb-2 flex items-center gap-2 px-2">
          <span className="text-doubt text-[11px] font-medium">
            🟣 Doubt mode — your message will be tagged as a question
          </span>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
      />

      <div className="flex items-end gap-2">
        <button
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title={uploading ? "Uploading…" : "Attach file"}
        >
          <Paperclip className={`h-5 w-5 ${uploading ? "animate-bounce" : ""}`} />
        </button>
        <button className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          <Smile className="h-5 w-5" />
        </button>
        <div className="relative flex-1">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onTyping?.();
            }}
            onKeyDown={handleKeyDown}
            placeholder={doubtMode ? "Type your doubt..." : "Type a message..."}
            rows={1}
            className={`scrollbar-thin max-h-32 w-full resize-none rounded-xl bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 ${
              doubtMode ? "focus:ring-doubt border-doubt/30 border" : "focus:ring-ring"
            }`}
            style={{ minHeight: "40px" }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="rounded-xl bg-primary p-2.5 text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
