import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FieldValues, UseFormReturn } from "react-hook-form";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";

// Inline Google logo so we don't pull a whole icon library for one mark.
const GoogleMark = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

// Auth capability flags from GET /api/auth/config. Only the fields this
// component actually gates on are declared.
interface AuthConfig {
  googleSignInEnabled?: boolean;
}

// Heuristic: parse a server error and detect rate-limiting so we can show
// a friendly cooldown message instead of a generic "Login failed".
function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return msg.includes("429") || msg.includes("too many") || msg.includes("rate limit");
}
import { useTranslation } from "@/lib/i18n";

import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";

import teacherImg from "@/assets/teacher-illustration.png";
import laptopImg from "@/assets/laptop.png";
import coffeeImg from "@/assets/coffee-mug.png";
import avatar1 from "@/assets/avatar-1.png";
import avatar2 from "@/assets/avatar-2.png";

const StudentBubble = ({
  color,
  size = 48,
  className = "",
  delay = 0,
  initials,
  avatarSrc,
}: {
  color: string;
  size?: number;
  className?: string;
  delay?: number;
  initials?: string;
  avatarSrc?: string;
}) => {
  return (
    <motion.div
      className={`z-20 flex items-center justify-center overflow-hidden rounded-full border-2 border-card shadow-md ${className}`}
      style={{ width: size, height: size, backgroundColor: color }}
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay }}
    >
      {avatarSrc ? (
        <img src={avatarSrc} alt={initials} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-semibold text-secondary-foreground">{initials}</span>
      )}
    </motion.div>
  );
};

const FloatingCard = ({
  title,
  subtitle,
  progress,
  tag,
  className = "",
  delay = 0,
}: {
  title: string;
  subtitle?: string;
  progress?: number;
  tag?: string;
  className?: string;
  delay?: number;
}) => {
  return (
    <motion.div
      className={`z-20 min-w-[160px] rounded-2xl bg-card px-5 py-4 shadow-lg shadow-foreground/5 ${className}`}
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay }}
    >
      <p className="text-sm font-bold text-card-foreground">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      {(progress !== undefined || tag) && (
        <div className="mt-2 flex items-center gap-3">
          {progress !== undefined && (
            <div className="relative flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="3"
                  strokeDasharray={`${progress * 0.88} 88`}
                  strokeLinecap="round"
                  transform="rotate(-90 18 18)"
                />
              </svg>
              <span className="absolute text-[8px] font-bold text-primary">{progress}%</span>
            </div>
          )}
          {tag && (
            <span className="rounded-md border border-input px-2.5 py-1 text-[11px] font-medium text-card-foreground">
              {tag}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
};

const IllustrationPanel = () => {
  const { t } = useTranslation();
  return (
    <div className="pointer-events-none relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-illustration">
      <svg
        className="absolute left-1/2 top-0 h-auto w-[80%] -translate-x-1/2 opacity-40"
        viewBox="0 0 500 120"
        fill="none"
      >
        <path
          d="M80 110 Q150 10 250 50 Q350 90 420 20"
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M100 100 Q170 30 250 60 Q330 90 400 30"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
      <StudentBubble
        color="hsl(var(--bubble-1))"
        initials="AS"
        avatarSrc={avatar1}
        className="absolute left-[12%] top-[12%]"
        delay={0}
        size={56}
      />
      <StudentBubble
        color="hsl(var(--bubble-2))"
        initials="MK"
        avatarSrc={avatar2}
        className="absolute right-[6%] top-[40%]"
        delay={1}
        size={52}
      />
      <div className="relative z-10 flex items-end justify-center">
        <motion.img
          src={laptopImg}
          alt="Laptop"
          className="-mr-4 mb-4 w-[100px] drop-shadow-sm lg:w-[120px] xl:w-[140px]"
          animate={{ y: [0, -5, 0], rotate: [-1, 1, -1] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
        <motion.img
          src={teacherImg}
          alt="AI Teacher"
          className="w-[240px] drop-shadow-sm lg:w-[300px] xl:w-[340px]"
          animate={{ scale: [1, 1.015, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.img
          src={coffeeImg}
          alt="Coffee mug"
          className="-ml-6 mb-2 w-[60px] drop-shadow-sm lg:w-[70px] xl:w-[80px]"
          animate={{ y: [0, -4, 0], rotate: [1, -1, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
        />
      </div>
      <FloatingCard
        title="AI Flashcards"
        subtitle="12 created today"
        progress={84}
        tag="Study"
        className="absolute bottom-[28%] left-[8%] lg:left-[10%]"
        delay={0.3}
      />
      <div className="relative z-10 mt-6 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        <span className="h-4 w-4 rounded-full bg-foreground" />
      </div>
      <p className="relative z-10 mt-5 px-6 text-center text-base text-foreground">
        {t("auth.easierOrganized", "Make your learning easier and organized")}
        <br />
        {t("auth.simplifyWorkflow", "Simplify your workflow and boost your productivity with")}{" "}
        <span className="font-bold">{t("auth.classMode", "ClassMode")}</span>
      </p>
    </div>
  );
};

const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

const registerPasswordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .regex(/[A-Za-z]/, { message: "Password must contain at least one letter" })
  .regex(/\d/, { message: "Password must contain at least one number" });

// Signup is workspace-owner only. Teachers and students join via invite links.
const registerSchema = z
  .object({
    name: z.string().min(2, { message: "Name must be at least 2 characters" }),
    email: z.string().email({ message: "Please enter a valid email address" }),
    password: registerPasswordSchema,
    confirmPassword: z.string().min(1, { message: "Please confirm your password" }),
    workspaceName: z.string().min(2, { message: "Workspace / school name is required" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;
export function AuthDialog() {
  const { t } = useTranslation();
  const { login, register, resetUserPassword } = useAuth();
  const [, setLocation] = useLocation();

  const [authTab, setAuthTab] = useState<"login" | "register" | "forgotPassword">("login");
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [isRegSubmitting, setIsRegSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      workspaceName: "",
    },
  });

  const onLoginSubmit = useCallback(
    async (data: LoginFormValues) => {
      setLoginError(null);
      setIsLoginSubmitting(true);
      try {
        const profile = await login(data.email, data.password);
        if (profile.emailVerified === false) {
          setLocation("/verify-email");
        } else {
          setLocation("/dashboard");
        }
      } catch (error: unknown) {
        const errorMessage = isRateLimitError(error)
          ? "Too many attempts. Please wait a minute and try again."
          : error instanceof Error
            ? error.message
            : "Login failed. Please try again.";
        setLoginError(errorMessage);
      } finally {
        setIsLoginSubmitting(false);
      }
    },
    [login, setLocation]
  );

  // Whether to offer Google at all. Rendered on a definite `true` only: while
  // the request is in flight, or if it failed, we show nothing rather than a
  // button that may strand the user on Google's error page. Email + password
  // is always present, so hiding this never leaves the dialog unusable.
  const { data: authConfig } = useQuery<AuthConfig>({ queryKey: ["/api/auth/config"] });
  const googleSignInEnabled = authConfig?.googleSignInEnabled === true;

  // Shared "Continue with Google" handler used by both Login and Register tabs.
  //
  // Drives a SERVER-SIDE OAuth code flow (/api/auth/google/start) — not the
  // Firebase JS SDK. Reason: signInWithPopup is broken by COOP +
  // wallet/ad-blocker extensions + popup blockers; signInWithRedirect loses
  // state across the redirect chain in too many edge cases. A full-page
  // navigation to our own backend, which then bounces to Google, sidesteps
  // every one of those issues. After consent the server creates the session
  // cookie and redirects to /dashboard directly.
  const onGoogleClick = useCallback(() => {
    if (isGoogleSubmitting) return;
    setLoginError(null);
    setRegisterError(null);
    setIsGoogleSubmitting(true);
    const wsHint = authTab === "register" ? registerForm.getValues("workspaceName") || "" : "";
    const url = wsHint
      ? `/api/auth/google/start?workspaceName=${encodeURIComponent(wsHint)}`
      : "/api/auth/google/start";
    window.location.href = url;
  }, [authTab, isGoogleSubmitting, registerForm]);

  const onForgotPasswordSubmit = useCallback(async () => {
    const email = loginForm.getValues("email");
    if (!email) {
      setLoginError("Please enter your email to reset password.");
      return;
    }
    setIsLoginSubmitting(true);
    setLoginError(null);
    try {
      await resetUserPassword(email);
      setResetEmailSent(true);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send reset email.";
      setLoginError(errorMessage);
    } finally {
      setIsLoginSubmitting(false);
    }
  }, [loginForm, resetUserPassword]);

  const onRegisterSubmit = useCallback(
    async (data: RegisterFormValues) => {
      setRegisterError(null);
      setIsRegSubmitting(true);
      try {
        await register(data.email, data.password, data.name, "admin", {
          workspaceName: data.workspaceName,
        });
        // Redirect to email verification — user must enter the 4-digit OTP before accessing the platform
        setLocation("/verify-email");
      } catch (error: unknown) {
        const errorMessage = isRateLimitError(error)
          ? "Too many attempts. Please wait a minute and try again."
          : error instanceof Error
            ? error.message
            : "Registration failed. Please try again.";
        setRegisterError(errorMessage);
      } finally {
        setIsRegSubmitting(false);
      }
    },
    [register, setLocation]
  );

  const inputClasses =
    "w-full rounded-full border border-input bg-card px-5 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:ring-2 focus:ring-ring/20 focus:border-primary";

  return (
    <div className="flex min-h-screen w-full flex-col bg-card font-sans lg:flex-row">
      {/* Mobile: illustration on top */}
      <div className="block h-[300px] lg:hidden">
        <IllustrationPanel />
      </div>

      {/* Left: Form */}
      <div className="relative z-50 flex min-h-[calc(100vh-300px)] w-full lg:min-h-screen lg:w-[45%]">
        <div className="pointer-events-auto relative z-50 mx-auto flex h-full w-full max-w-lg flex-col justify-center px-8 py-12 sm:px-12 lg:px-16 xl:px-20">
          <h1 className="font-display text-4xl font-bold text-foreground">
            {authTab === "login" && "Welcome back!"}
            {authTab === "register" && (
              <span className="text-3xl">{t("auth.createAccount", "Create an account")}</span>
            )}
            {authTab === "forgotPassword" && (
              <span className="text-3xl">{t("auth.resetPassword", "Reset Password")}</span>
            )}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("auth.simplifyWorkflow", "Simplify your workflow and boost your productivity with")}{" "}
            <span className="font-semibold text-foreground">
              {t("auth.classMode", "ClassMode")}
            </span>
            .{" "}
            {authTab === "login"
              ? "Get started for free."
              : authTab === "register"
                ? "Join us for free."
                : "No worries, we will send you reset instructions."}
          </p>

          {authTab === "forgotPassword" && (
            <div className="mt-8 space-y-4">
              {!resetEmailSent ? (
                <>
                  <div className="space-y-4">
                    <input
                      type="email"
                      placeholder="Enter your email"
                      className={inputClasses}
                      value={loginForm.watch("email")}
                      onChange={(e) => loginForm.setValue("email", e.target.value)}
                      disabled={isLoginSubmitting}
                    />
                    {loginError && <p className="px-2 text-xs text-red-500">{loginError}</p>}
                    <button
                      type="button"
                      onClick={onForgotPasswordSubmit}
                      disabled={isLoginSubmitting || !loginForm.watch("email")}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover active:scale-[0.98]"
                    >
                      {isLoginSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      Send Reset Link
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4 py-4 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <svg
                      className="h-6 w-6 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium">
                    {t("auth.checkEmail", "Check your email")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("auth.weDispatched", "We've sent a password reset link to")}{" "}
                    <span className="font-semibold text-foreground">
                      {loginForm.getValues("email")}
                    </span>
                    .
                  </p>
                </div>
              )}
              <button
                type="button"
                className="mt-6 w-full text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => {
                  setAuthTab("login");
                  setResetEmailSent(false);
                  setLoginError(null);
                }}
              >
                {t("auth.backToLogin", "Back to login")}
              </button>
            </div>
          )}

          {authTab === "login" &&
            React.createElement(
              Form as React.FC<UseFormReturn<FieldValues> & { children?: React.ReactNode }>,
              loginForm as unknown as UseFormReturn<FieldValues>,
              <form
                key="login-form"
                className="mt-8 space-y-4"
                onSubmit={loginForm.handleSubmit(onLoginSubmit)}
              >
                {loginError && (
                  <div className="rounded-lg bg-red-100 p-3 text-sm font-medium text-red-600">
                    {loginError}
                  </div>
                )}
                {googleSignInEnabled && (
                  <>
                    <button
                      type="button"
                      onClick={onGoogleClick}
                      disabled={isLoginSubmitting || isGoogleSubmitting}
                      className="flex w-full items-center justify-center gap-3 rounded-full border border-input bg-card py-3 text-sm font-medium text-foreground transition-all hover:bg-muted/40 active:scale-[0.99] disabled:opacity-60"
                      data-testid="login-google-btn"
                    >
                      {isGoogleSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <GoogleMark />
                      )}
                      Continue with Google
                    </button>
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                        or
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  </>
                )}
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <input
                          type="email"
                          placeholder="Username/Email"
                          disabled={isLoginSubmitting}
                          className={inputClasses}
                          name={field.name}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage className="px-2 text-xs text-red-500" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            disabled={isLoginSubmitting}
                            className={inputClasses}
                            name={field.name}
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            ref={field.ref}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="px-2 text-xs text-red-500" />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pr-2">
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent p-0 text-sm font-medium text-foreground transition-colors hover:text-primary"
                    onClick={() => {
                      setLoginError(null);
                      setAuthTab("forgotPassword");
                    }}
                  >
                    {t("auth.forgotPassword", "Forgot Password?")}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isLoginSubmitting}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover active:scale-[0.98]"
                >
                  {isLoginSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Login
                </button>
              </form>
            )}

          {authTab === "register" &&
            React.createElement(
              Form as React.FC<UseFormReturn<FieldValues> & { children?: React.ReactNode }>,
              registerForm as unknown as UseFormReturn<FieldValues>,
              <form
                key="register-form"
                className="mt-6 space-y-3"
                onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
              >
                {registerError && (
                  <div className="rounded-lg bg-red-100 p-3 text-sm font-medium text-red-600">
                    {registerError}
                  </div>
                )}
                {googleSignInEnabled && (
                  <>
                    <button
                      type="button"
                      onClick={onGoogleClick}
                      disabled={isRegSubmitting || isGoogleSubmitting}
                      className="flex w-full items-center justify-center gap-3 rounded-full border border-input bg-card py-3 text-sm font-medium text-foreground transition-all hover:bg-muted/40 active:scale-[0.99] disabled:opacity-60"
                      data-testid="register-google-btn"
                    >
                      {isGoogleSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <GoogleMark />
                      )}
                      Continue with Google
                    </button>
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                        or
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  </>
                )}
                <FormField
                  control={registerForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <input
                          id="register-name"
                          type="text"
                          autoComplete="name"
                          placeholder="Full Name"
                          disabled={isRegSubmitting}
                          className={inputClasses + " py-2.5"}
                          name={field.name}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage className="px-2 text-xs text-red-500" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <input
                          type="email"
                          placeholder="Email"
                          disabled={isRegSubmitting}
                          className={inputClasses + " py-2.5"}
                          name={field.name}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage className="px-2 text-xs text-red-500" />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              placeholder="Password"
                              disabled={isRegSubmitting}
                              className={inputClasses + " py-2.5"}
                              name={field.name}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              ref={field.ref}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                              aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage className="px-2 text-[10px] text-red-500" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirm"
                              disabled={isRegSubmitting}
                              className={inputClasses + " py-2.5"}
                              name={field.name}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              ref={field.ref}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                            >
                              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage className="px-2 text-[10px] text-red-500" />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={registerForm.control}
                  name="workspaceName"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <input
                          type="text"
                          placeholder="Workspace / company name"
                          disabled={isRegSubmitting}
                          className={inputClasses + " py-2.5"}
                          name={field.name}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage className="px-2 text-xs text-red-500" />
                    </FormItem>
                  )}
                />
                {/* Invite callout — teachers & students join via links, not public signup */}
                <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-center text-xs leading-relaxed text-muted-foreground">
                  🎓 Teachers and students join via{" "}
                  <span className="font-semibold text-foreground">invite links</span> from the
                  workspace settings — no separate signup needed.
                </p>

                <button
                  type="submit"
                  disabled={isRegSubmitting}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-white transition-all hover:bg-accent-hover active:scale-[0.98]"
                >
                  {isRegSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Account
                </button>
              </form>
            )}

          <p className="mt-8 text-center text-sm text-muted-foreground">
            {authTab === "login"
              ? "Not a member? "
              : authTab === "register"
                ? "Already have an account? "
                : "Remembered your password? "}
            <button
              type="button"
              className="cursor-pointer border-none bg-transparent font-semibold text-primary transition-colors hover:text-accent"
              onClick={() => {
                setAuthTab(authTab === "login" ? "register" : "login");
                setResetEmailSent(false);
                setLoginError(null);
                setRegisterError(null);
              }}
            >
              {authTab === "login" ? "Register now" : "Login"}
            </button>
          </p>
        </div>
      </div>

      {/* Right: Illustration (desktop) */}
      <div className="hidden min-h-screen w-[55%] overflow-hidden rounded-l-[2.5rem] drop-shadow-2xl lg:flex">
        <IllustrationPanel />
      </div>
    </div>
  );
}
