import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { Loader2, Mail, ShieldCheck, RefreshCw, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import heroImg from "@/assets/hero-runway.png";

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isStartingOver, setIsStartingOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { currentUser, refreshSession, logout, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Escape hatch: user typed the wrong email at signup. Clear the session,
  // bounce them back to /login. They can register again with the correct
  // address (or log in if they realize they already have an account).
  const handleStartOver = async () => {
    if (isStartingOver) return;
    setIsStartingOver(true);
    try {
      await logout();
    } catch {
      // logout is best-effort; even if the server call fails we still want
      // to clear the client and get the user out of this stuck state.
    } finally {
      setLocation("/login");
    }
  };

  const setInputRef = (idx: number, el: HTMLInputElement | null) => {
    switch (idx) {
      case 0:
        inputRefs.current[0] = el;
        break;
      case 1:
        inputRefs.current[1] = el;
        break;
      case 2:
        inputRefs.current[2] = el;
        break;
      case 3:
        inputRefs.current[3] = el;
        break;
    }
  };

  const focusInputRef = (idx: number) => {
    switch (idx) {
      case 0:
        inputRefs.current[0]?.focus();
        break;
      case 1:
        inputRefs.current[1]?.focus();
        break;
      case 2:
        inputRefs.current[2]?.focus();
        break;
      case 3:
        inputRefs.current[3]?.focus();
        break;
    }
  };

  const getOtpDigit = (idx: number): string => {
    switch (idx) {
      case 0:
        return otp[0];
      case 1:
        return otp[1];
      case 2:
        return otp[2];
      case 3:
        return otp[3];
      default:
        return "";
    }
  };

  // If user is already verified, redirect to dashboard
  useEffect(() => {
    if (isLoading) return;
    if (currentUser.profile?.emailVerified) {
      setLocation("/dashboard");
    }
  }, [currentUser.profile?.emailVerified, setLocation, isLoading]);

  // If not logged in at all (and done loading), redirect to login
  useEffect(() => {
    if (isLoading) return;
    if (!currentUser.profile && !currentUser.user) {
      setLocation("/login");
    }
  }, [currentUser.profile, currentUser.user, setLocation, isLoading]);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleInput = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = otp.map((item, idx) => (idx === index ? digit : item));
    setOtp(newOtp);
    setError(null);

    if (digit && index < 3) {
      focusInputRef(index + 1);
    }

    // Auto-submit when all 4 digits entered
    if (digit && index === 3) {
      const fullCode = newOtp.join("");
      if (fullCode.length === 4) {
        submitOtp(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !getOtpDigit(index) && index > 0) {
      focusInputRef(index - 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted.length === 4) {
      setOtp(pasted.split(""));
      setError(null);
      focusInputRef(3);
      submitOtp(pasted);
    }
  };

  const submitOtp = async (code: string) => {
    if (code.length !== 4 || isVerifying) return;
    setIsVerifying(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: code }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Invalid verification code");
      }

      // Refresh the session to pick up emailVerified = true
      await refreshSession();

      toast({
        title: "Email Verified! 🎉",
        description: "Your account is now fully activated. Welcome to Class Mode!",
      });

      setLocation("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid code. Please try again.";
      setError(msg);
      setOtp(["", "", "", ""]);
      focusInputRef(0);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (isResending || resendCooldown > 0) return;
    setIsResending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/email/verify/request", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to resend code");
      }

      setResendCooldown(60);
      toast({
        title: "Code Resent!",
        description: "A fresh 4-digit code has been dispatched to your inbox.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resend code.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsResending(false);
    }
  };

  const handleManualSubmit = () => {
    const code = otp.join("");
    if (code.length === 4) {
      submitOtp(code);
    }
  };

  // Auto-verify when user clicks the email link (token is in the URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken && /^\d{4}$/.test(urlToken) && !isLoading) {
      setOtp(urlToken.split(""));
      // Brief delay so inputs render filled before the spinner appears
      const timer = setTimeout(() => submitOtp(urlToken), 350);
      return () => clearTimeout(timer);
    }
    // submitOtp is stable within the render; only re-run when loading finishes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const userEmail = currentUser.profile?.email || "your email";

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4 text-foreground selection:bg-primary/20">
      {/* Background runway illustration to match the landing page perfectly */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <img
          src={heroImg}
          alt="Illustrated airport runway background"
          className="h-full w-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
      </div>

      {/* Theme toggle located at the top-right */}
      <div className="absolute right-6 top-6 z-50">
        <ThemeToggle />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Card */}
        <div className="sketch-border sketch-shadow-yellow relative overflow-hidden bg-card px-8 pb-10 pt-8 text-card-foreground">
          {/* Top accent bar matching primary theme color */}
          <div className="absolute left-0 right-0 top-0 h-1.5 bg-primary" />

          <div>
            {/* Icon */}
            <motion.div
              className="mb-6 flex justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
            >
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-foreground bg-background text-foreground shadow-[4px_4px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_hsl(var(--primary))]">
                  <Mail className="h-7 w-7" />
                </div>
              </div>
            </motion.div>

            {/* Header */}
            <div className="mb-2 text-center">
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
                {t("verify.title", "Verify Your Email")}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t("verify.dispatched", "We've dispatched a")}{" "}
                <span className="font-bold text-primary">4-digit secure code</span> to
              </p>
              <p
                className="mt-1 truncate text-sm font-bold text-foreground"
                data-testid="verify-email-target"
              >
                {userEmail}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Code expires in 15 minutes. Check your spam folder if you don't see it.
              </p>
            </div>

            {/* OTP Digit Inputs */}
            <div className="my-8 flex justify-center gap-3" onPaste={handlePaste}>
              {otp.map((digit, i) => (
                <motion.input
                  key={i}
                  ref={(el) => setInputRef(i, el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInput(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  autoFocus={i === 0}
                  disabled={isVerifying}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.07 }}
                  className={[
                    "h-16 w-14 rounded-2xl border-2 bg-background text-center text-2xl font-black text-foreground outline-none transition-all duration-150",
                    "focus:border-primary focus:ring-2 focus:ring-primary/20",
                    digit
                      ? "border-primary shadow-[3px_3px_0px_hsl(var(--primary))]"
                      : "border-border shadow-sm",
                    error ? "border-destructive focus:border-destructive" : "",
                    "disabled:opacity-50",
                  ].join(" ")}
                />
              ))}
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                className="mb-6 rounded-xl border-2 border-destructive bg-destructive/5 px-4 py-3 text-center text-sm font-semibold text-destructive"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.div>
            )}

            {/* Verify Button */}
            <button
              onClick={handleManualSubmit}
              disabled={otp.join("").length !== 4 || isVerifying}
              className="sketch-border sketch-shadow-yellow hover-tilt flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-heading text-base font-bold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/30 disabled:text-primary-foreground/70"
            >
              {isVerifying ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
              {isVerifying ? "Verifying Access..." : "Verify & Enter"}
            </button>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">
                {t("verify.didNotReceive", "didn't receive it?")}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Resend */}
            <button
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
              className="sketch-border sketch-shadow hover-tilt flex w-full items-center justify-center gap-2 rounded-full bg-card py-3 font-heading text-sm font-semibold text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${isResending ? "animate-spin" : ""}`} />
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : isResending
                  ? "Sending..."
                  : "Resend Code"}
            </button>

            {/* Escape hatches: wrong email + already have account */}
            <div className="mt-6 flex flex-col items-center gap-3 text-center text-sm">
              <button
                type="button"
                onClick={handleStartOver}
                disabled={isStartingOver || isVerifying}
                className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                data-testid="verify-wrong-email"
              >
                {isStartingOver ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowLeft className="h-3.5 w-3.5" />
                )}
                Wrong email? Sign out and start over
              </button>
              <span className="text-xs text-muted-foreground/70">
                Already verified on another device?{" "}
                <button
                  type="button"
                  onClick={handleStartOver}
                  disabled={isStartingOver || isVerifying}
                  className="font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Log in instead
                </button>
              </span>
            </div>

            {/* Quote footer */}
            <p className="mt-8 text-center font-body text-xs italic text-muted-foreground">
              "Education is not the filling of a pail, but the lighting of a fire."
            </p>
            <p className="mt-1 text-center font-sans text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              — William Butler Yeats
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
