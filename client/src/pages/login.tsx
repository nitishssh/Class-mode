import { useEffect } from "react";
import { useLocation } from "wouter";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { FirebaseAuthDialog } from "@/components/auth/firebase-auth-dialog";

export default function LoginPage() {
  const {
    currentUser: { profile },
    isLoading,
  } = useFirebaseAuth();
  const [, setLocation] = useLocation();

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
      <FirebaseAuthDialog />
    </div>
  );
}
