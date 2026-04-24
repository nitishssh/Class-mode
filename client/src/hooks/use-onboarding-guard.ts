import { useEffect } from "react";
import { useLocation } from "wouter";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { useQuery } from "@tanstack/react-query";

const ONBOARDING_PATHS = [
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

  const { data: school } = useQuery<any>({
    queryKey: ["/api/school/me"],
    enabled: profile?.role === "school_admin",
    retry: false,
  });

  const { data: mongoUser } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    enabled: !!profile,
    retry: false,
  });

  useEffect(() => {
    // Don't redirect if already on an onboarding page (prevents redirect loops)
    if (!profile || ONBOARDING_PATHS.includes(location)) return;

    if (profile.role === "school_admin" && school && !school.onboardingComplete) {
      setLocation("/onboarding/school");
      return;
    }

    if (profile.role === "teacher" && mongoUser && !mongoUser.onboardingComplete) {
      setLocation("/onboarding/teacher");
      return;
    }
  }, [profile, school, mongoUser, location, setLocation]);
}
