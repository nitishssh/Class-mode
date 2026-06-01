import { useEffect } from "react";
import { useLocation } from "wouter";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { useQuery } from "@tanstack/react-query";

const ONBOARDING_PATHS = [
  "/onboarding",
  "/onboarding/school",
  "/onboarding/invite-teachers",
  "/onboarding/teacher",
  "/onboarding/invite-students",
];

export function useOnboardingGuard() {
  const {
    currentUser: { profile },
  } = useFirebaseAuth();
  const [location, setLocation] = useLocation();

  const { data: mongoUser } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    enabled: !!profile,
    retry: false,
  });

  useEffect(() => {
    // Don't redirect if already on an onboarding page (prevents redirect loops)
    if (!profile || ONBOARDING_PATHS.includes(location) || !mongoUser) return;

    // Roles that skip onboarding
    if (["student", "parent", "admin"].includes(profile.role)) {
      return; // let them through
    }

    if (!mongoUser.onboardingComplete) {
      setLocation("/onboarding");
      return;
    }
  }, [profile, mongoUser, location, setLocation]);
}
