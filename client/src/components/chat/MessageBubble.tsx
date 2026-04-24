import { Message } from "@/types/chat";
import MessageStatusIcon from "./MessageStatusIcon";
import { format } from "date-fns";
import { Pin, HelpCircle, CheckCircle2, Megaphone, FileText, Calendar, Reply } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSender?: boolean;
  senderName?: string;
  replyContent?: string;
}

const MessageBubble = ({
  message,
  isOwn,
  showSender,
  senderName,
  replyContent,
}: MessageBubbleProps) => {
  const time = format(message.timestamp, "HH:mm");

  // Announcement
  if (message.type === "announcement") {
    return (
      <div className="animate-slide-in mb-2 flex justify-center px-4">
        <div className="bg-announcement-bg border-announcement/20 max-w-[85%] rounded-xl border px-4 py-3">
          <div className="mb-1.5 flex items-center gap-2">
            <Megaphone className="text-announcement h-4 w-4" />
            <span className="text-announcement text-xs font-semibold">Announcement</span>
            {message.isPinned && <Pin className="text-pinned h-3 w-3" />}
          </div>
          <p className="text-sm leading-relaxed text-foreground">{message.content}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{senderName}</span>
            <span className="text-[10px] text-muted-foreground">•</span>
            <span className="text-[10px] text-muted-foreground">{time}</span>
          </div>
        </div>
      </div>
    );
  }

  // Assignment
  if (message.type === "assignment" && message.assignmentData) {
    const ad = message.assignmentData;
    return (
      <div className="animate-slide-in mb-2 flex justify-center px-4">
        <div className="bg-assignment-bg border-assignment/20 w-full max-w-[85%] rounded-xl border px-4 py-3">
          <div className="mb-2 flex items-center gap-2">
            <FileText className="text-assignment h-4 w-4" />
            <span className="text-assignment text-xs font-semibold">Assignment</span>
          </div>
          <h4 className="mb-1 text-sm font-semibold text-foreground">{ad.title}</h4>
          <p className="mb-2 text-sm text-foreground/80">{message.content}</p>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-assignment flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Due: {format(ad.dueDate, "MMM d, yyyy")}
            </span>
            <span className="text-muted-foreground">{ad.subject}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {senderName} • {time}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Doubt
  const isDoubt = message.type === "doubt";

  // System
  if (message.type === "system") {
    return (
      <div className="animate-slide-in mb-2 flex justify-center px-4">
        <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
          {message.content}
        </span>
      </div>
    );
  }

  // Regular text / media / doubt
  const roleColorClass =
    message.senderRole === "teacher"
      ? "text-role-teacher"
      : message.senderRole === "parent"
        ? "text-role-parent"
        : "text-role-student";

  return (
    <div className={`animate-slide-in flex ${isOwn ? "justify-end" : "justify-start"} mb-1 px-4`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${isDoubt ? "border-doubt/30 border" : ""}${
          isOwn
            ? `${isDoubt ? "bg-doubt-bg" : "bg-bubble-own"} text-bubble-own-foreground rounded-br-md`
            : `${isDoubt ? "bg-doubt-bg" : "bg-bubble-other"} text-bubble-other-foreground rounded-bl-md`
        }`}
      >
        {/* Doubt badge */}
        {isDoubt && (
          <div className="mb-1 flex items-center gap-1.5">
            <HelpCircle className="text-doubt h-3.5 w-3.5" />
            <span className="text-doubt text-[10px] font-semibold">
              {message.isDoubtAnswered === false
                ? "Doubt — Unanswered"
                : message.isDoubtAnswered
                  ? "Doubt — Answered ✅"
                  : "Doubt"}
            </span>
          </div>
        )}

        {/* Sender name */}
        {showSender && senderName && (
          <p className={`mb-0.5 text-xs font-semibold ${roleColorClass}`}>{senderName}</p>
        )}

        {/* Reply preview */}
        {replyContent && (
          <div className="mb-1.5 flex items-center gap-1.5 border-l-2 border-primary/40 pl-2">
            <Reply className="h-3 w-3 text-muted-foreground" />
            <span className="truncate text-[11px] text-muted-foreground">{replyContent}</span>
          </div>
        )}

        {/* Pinned badge */}
        {message.isPinned && (
          <div className="mb-1 flex items-center gap-1">
            <Pin className="text-pinned h-3 w-3" />
            <span className="text-pinned text-[10px] font-medium">Pinned</span>
          </div>
        )}

        {/* Image */}
        {message.type === "image" && message.mediaUrl && (
          <div className="mb-1.5 overflow-hidden rounded-lg">
            <img
              src={message.mediaUrl}
              alt={message.content}
              className="h-auto w-full max-w-[280px] object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Text content */}
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>

        {/* Mentions */}
        {message.mentions && message.mentions.length > 0 && (
          <div className="mt-0.5">
            {message.mentions.map((m) => (
              <span key={m} className="text-[10px] font-medium text-primary">
                @mentioned{" "}
              </span>
            ))}
          </div>
        )}

        {/* Time + status */}
        <div
          className={`mt-0.5 flex items-center gap-1 ${isOwn ? "justify-end" : "justify-start"}`}
        >
          <span className="text-[10px] text-muted-foreground">{time}</span>
          {isOwn && <MessageStatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
