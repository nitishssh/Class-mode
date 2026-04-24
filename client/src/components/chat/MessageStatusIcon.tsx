import { Check, CheckCheck, Clock } from "lucide-react";
import { MessageStatus as Status } from "@/types/chat";

interface MessageStatusProps {
  status: Status;
}

const MessageStatusIcon = ({ status }: MessageStatusProps) => {
  switch (status) {
    case "sending":
      return <Clock className="text-status-sent h-3.5 w-3.5" />;
    case "sent":
      return <Check className="text-status-sent h-3.5 w-3.5" />;
    case "delivered":
      return <CheckCheck className="text-status-delivered h-3.5 w-3.5" />;
    case "read":
      return <CheckCheck className="text-status-read h-3.5 w-3.5" />;
    default:
      return null;
  }
};

export default MessageStatusIcon;
