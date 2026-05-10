import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, Check } from "lucide-react";

export function CookieBanner() {
  const [show, setShow] = useState(() => !localStorage.getItem("cookie-consent"));

  const accept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setShow(false);
  };

  const decline = () => {
    localStorage.setItem("cookie-consent", "declined");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Cookie className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm">
            We use cookies to improve your experience.{" "}
            <a href="/privacy" className="underline">
              Privacy Policy
            </a>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={decline}>
            Decline
          </Button>
          <Button size="sm" onClick={accept}>
            <Check className="mr-2 h-4 w-4" /> Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
