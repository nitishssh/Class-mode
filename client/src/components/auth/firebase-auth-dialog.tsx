import React, { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { UserRole } from "@/lib/firebase";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FieldValues, UseFormReturn } from "react-hook-form";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
        <span className="font-bold">{t("auth.classMode", "Class Mode")}</span>
      </p>
    </div>
  );
};

const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const registerSchema = z
  .object({
    name: z.string().min(2, { message: "Name must be at least 2 characters" }),
    email: z.string().email({ message: "Please enter a valid email address" }),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
    confirmPassword: z.string().min(1, { message: "Please confirm your password" }),
    workspaceName: z.string().min(2, { message: "Workspace name is required" }),
    role: z.enum(["admin", "teacher", "principal", "school_admin", "parent"], {
      required_error: "Please select a role",
    }),
    grade: z.string().optional(),
    board: z.string().optional(),
    school_code: z.string().optional(),
    subjects: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
  .refine(
    (data) =>
      !["teacher", "principal", "school_admin"].includes(data.role) || !!data.school_code,
    {
      message: "School code is required",
      path: ["school_code"],
    }
  );

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export function FirebaseAuthDialog() {
  const { t } = useTranslation();
  const { login, register, resetUserPassword } = useFirebaseAuth();
  const [, setLocation] = useLocation();

  const [authTab, setAuthTab] = useState<"login" | "register" | "forgotPassword">("login");
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [isRegSubmitting, setIsRegSubmitting] = useState(false);

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
      role: "admin",
      workspaceName: "",
      grade: "12",
      board: "CBSE",
    },
  });

  const onLoginSubmit = useCallback(
    async (data: LoginFormValues) => {
      setLoginError(null);
      setIsLoginSubmitting(true);
      try {
        await login(data.email, data.password);
        setLocation("/dashboard");
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Login failed. Please try again.";
        setLoginError(errorMessage);
      } finally {
        setIsLoginSubmitting(false);
      }
    },
    [login, setLocation]
  );

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

  const getRoleSpecificData = (role: string, data?: Partial<RegisterFormValues>) => {
    const subjectsArray = data?.subjects
      ? data.subjects.split(",").map((s: string) => s.trim())
      : [];
    switch (role) {
      case "admin":
        return { workspaceName: data?.workspaceName };
      case "teacher":
        return { school_code: data?.school_code, subjects: subjectsArray };
      case "principal":
      case "school_admin":
        return { school_code: data?.school_code };
      case "parent":
        return {};
      default:
        return {};
    }
  };

  const onRegisterSubmit = useCallback(
    async (data: RegisterFormValues) => {
      setRegisterError(null);
      setIsRegSubmitting(true);
      try {
        const additionalData = getRoleSpecificData(data.role, data);
        await register(data.email, data.password, data.name, data.role as UserRole, additionalData);
        // Redirect to email verification — user must enter the 4-digit OTP before accessing the platform
        setLocation("/verify-email");
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Registration failed. Please try again.";
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
            {authTab === "register" && <span className="text-3xl">{t("auth.createAccount", "Create an account")}</span>}
            {authTab === "forgotPassword" && <span className="text-3xl">{t("auth.resetPassword", "Reset Password")}</span>}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("auth.simplifyWorkflow", "Simplify your workflow and boost your productivity with")}{" "}
            <span className="font-semibold text-foreground">{t("auth.classMode", "Class Mode")}</span>.{" "}
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
                      className="bg-eduai-primary hover:bg-eduai-accent mt-2 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white transition-all active:scale-[0.98]"
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
                  <h3 className="text-lg font-medium">{t("auth.checkEmail", "Check your email")}</h3>
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
                  className="bg-eduai-primary hover:bg-eduai-accent mt-2 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white transition-all active:scale-[0.98]"
                >
                  {isLoginSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Login
                </button>
              </form>
            )
          }

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
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={registerForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <select
                            disabled={isRegSubmitting}
                            className={inputClasses + " appearance-none py-2.5"}
                            name={field.name}
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            ref={field.ref}
                          >
                            <option value="admin">{t("auth.role.owner", "Workspace Owner")}</option>
                            <option value="teacher">{t("auth.role.teacher", "Teacher")}</option>
                            <option value="principal">{t("auth.role.principal", "Principal")}</option>
                            <option value="school_admin">{t("auth.role.schoolAdmin", "School Admin")}</option>
                            <option value="parent">{t("auth.role.parent", "Parent")}</option>
                          </select>
                        </FormControl>
                        <FormMessage className="px-2 text-[10px] text-red-500" />
                      </FormItem>
                    )}
                  />
                  {["teacher", "principal", "school_admin"].includes(
                    registerForm.watch("role")
                  ) && (
                    <FormField
                      control={registerForm.control}
                      name="school_code"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormControl>
                            <input
                              type="text"
                              placeholder="School Code"
                              disabled={isRegSubmitting}
                              className={inputClasses + " py-2.5"}
                              name={field.name}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              ref={field.ref}
                            />
                          </FormControl>
                          <FormMessage className="px-2 text-[10px] text-red-500" />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isRegSubmitting}
                  className="bg-eduai-primary hover:bg-eduai-accent mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white transition-all active:scale-[0.98]"
                >
                  {isRegSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Account
                </button>
              </form>
            )
          }

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
