import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { Loader2, Mail, ShieldCheck, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function VerifyEmailPage() {
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { currentUser, refreshSession, isLoading } = useFirebaseAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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

  const userEmail = currentUser.profile?.email || "your email";

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-indigo-950 via-violet-900 to-purple-950 p-4">
      {/* Animated ambient background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <motion.div
        className="relative w-full max-w-md"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-2xl">
          {/* Top gradient band */}
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

          <div className="px-8 pb-10 pt-8">
            {/* Icon */}
            <motion.div
              className="mb-6 flex justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
            >
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-indigo-500/30" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
                  <Mail className="h-7 w-7 text-white" />
                </div>
              </div>
            </motion.div>

            {/* Header */}
            <div className="mb-2 text-center">
              <h1 className="text-2xl font-black tracking-tight text-white">
                Verify Your Email
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white/60">
                We've dispatched a{" "}
                <span className="font-semibold text-indigo-300">4-digit secure code</span> to
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-white/80">
                {userEmail}
              </p>
            </div>

            {/* OTP Digit Inputs */}
            <div
              className="my-8 flex justify-center gap-3"
              onPaste={handlePaste}
            >
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
                    "h-16 w-14 rounded-2xl border-2 bg-white/10 text-center text-2xl font-black text-white outline-none backdrop-blur-sm",
                    "transition-all duration-150",
                    "focus:border-indigo-400 focus:bg-indigo-500/20 focus:shadow-lg focus:shadow-indigo-500/20",
                    digit ? "border-violet-400 bg-violet-500/20 shadow-md shadow-violet-500/20" : "border-white/20",
                    error ? "border-red-400/70" : "",
                    "disabled:opacity-50",
                  ].join(" ")}
                />
              ))}
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300"
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
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all duration-150 hover:from-indigo-400 hover:to-violet-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {isVerifying ? "Verifying Access..." : "Verify & Enter"}
            </button>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-white/30">didn't receive it?</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Resend */}
            <button
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/70 transition-all duration-150 hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${isResending ? "animate-spin" : ""}`} />
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : isResending
                ? "Sending..."
                : "Resend Code"}
            </button>

            {/* Quote footer */}
            <p className="mt-8 text-center text-xs italic text-white/30">
              "Education is not the filling of a pail, but the lighting of a fire."
            </p>
            <p className="mt-1 text-center text-[10px] font-semibold tracking-widest text-white/20 uppercase">
              — William Butler Yeats
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
