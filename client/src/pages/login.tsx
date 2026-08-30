import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { useToast } from "@/hooks/use-toast";

// Map server-side OAuth-failure error codes (set as ?error=… on a redirect
// back to /login) to user-friendly toast copy.
const GOOGLE_OAUTH_ERROR_COPY: Record<string, string> = {
  google_oauth_missing_params: "Google sign-in didn't return a valid response. Please try again.",
  google_oauth_csrf: "Google sign-in security check failed. Please try again.",
  google_oauth_exchange: "Couldn't complete sign-in with Google. Please try again.",
  google_signin_failed: "Sign-in failed. Please try again or use email + password.",
  // Set by /api/auth/google/start when the flag is off — reachable from a
  // stale tab or a bookmarked link after the button has been hidden.
  google_signin_disabled:
    "Google sign-in is currently unavailable. Please sign in with email + password.",
  account_inactive: "Your account is suspended. Please contact support.",
};

export default function LoginPage() {
  const {
    currentUser: { profile },
    isLoading,
  } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Show a toast if we just came back from /api/auth/google/callback with
  // an error. Clean the query param so a refresh doesn't re-fire the toast.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err && GOOGLE_OAUTH_ERROR_COPY[err]) {
      toast({
        title: "Google sign-in",
        description: GOOGLE_OAUTH_ERROR_COPY[err],
        variant: "destructive",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast]);

  // Already logged in — go to dashboard (or verify-email if not yet verified)
  useEffect(() => {
    if (isLoading) return;
    if (!profile) return;
    if (profile.emailVerified === false) {
      setLocation("/verify-email");
    } else {
      setLocation("/dashboard");
    }
  }, [profile, setLocation, isLoading]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <AuthDialog />
    </div>
  );
}
