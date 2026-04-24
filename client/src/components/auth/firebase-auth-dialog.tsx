import { useState, useCallback, useMemo } from "react";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { UserRole } from "@/lib/firebase";
import { User } from "firebase/auth";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
}: any) => {
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

const FloatingCard = ({ title, subtitle, progress, tag, className = "", delay = 0 }: any) => {
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
        Make your learning easier and organized
        <br />
        with <span className="font-bold">EduAI</span>
      </p>
    </div>
  );
};

export function FirebaseAuthDialog() {
  const { login, register, googleLogin, completeGoogleRegistration, resetUserPassword } =
    useFirebaseAuth();
  const [isNewGoogleUser, setIsNewGoogleUser] = useState(false);
  const [tempGoogleUser, setTempGoogleUser] = useState<User | null>(null);
  const [authTab, setAuthTab] = useState<"login" | "register" | "forgotPassword">("login");
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [isRegSubmitting, setIsRegSubmitting] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.string().email({ message: "Please enter a valid email address" }),
        password: z.string().min(6, { message: "Password must be at least 6 characters" }),
      }),
    []
  );

  const registerSchema = useMemo(
    () =>
      z
        .object({
          name: z.string().min(2, { message: "Name must be at least 2 characters" }),
          email: z.string().email({ message: "Please enter a valid email address" }),
          password: z.string().min(6, { message: "Password must be at least 6 characters" }),
          confirmPassword: z.string().min(1, { message: "Please confirm your password" }),
          role: z.enum(["student", "teacher", "principal", "school_admin", "admin", "parent"], {
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
        .refine((data) => data.role !== "student" || (!!data.grade && !!data.board), {
          message: "Please select both grade and board",
          path: ["grade"],
        })
        .refine(
          (data) =>
            !["teacher", "principal", "school_admin"].includes(data.role) || !!data.school_code,
          {
            message: "School code is required",
            path: ["school_code"],
          }
        ),
    []
  );

  const roleSchema = useMemo(
    () =>
      z
        .object({
          role: z.enum(["student", "teacher", "principal", "school_admin", "admin", "parent"], {
            required_error: "Please select a role",
          }),
          grade: z.string().optional(),
          board: z.string().optional(),
          school_code: z.string().optional(),
          subjects: z.string().optional(),
        })
        .refine((data) => data.role !== "student" || (!!data.grade && !!data.board), {
          message: "Please select both grade and board",
          path: ["grade"],
        })
        .refine(
          (data) =>
            !["teacher", "principal", "school_admin"].includes(data.role) || !!data.school_code,
          {
            message: "School code is required",
            path: ["school_code"],
          }
        ),
    []
  );

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "student",
      grade: "12",
      board: "CBSE",
    },
  });

  const roleForm = useForm<z.infer<typeof roleSchema>>({
    resolver: zodResolver(roleSchema),
    defaultValues: { role: "student", grade: "12", board: "CBSE" },
  });

  const selectedGoogleRole = roleForm.watch("role");

  const onLoginSubmit = useCallback(
    async (data: z.infer<typeof loginSchema>) => {
      setLoginError(null);
      setIsLoginSubmitting(true);
      try {
        await login(data.email, data.password);
      } catch (error: any) {
        const code = error.code || "";
        const firebaseNotConfigured = error.message === "Firebase is not configured";
        if (
          firebaseNotConfigured ||
          code === "auth/operation-not-allowed" ||
          code === "auth/invalid-login-credentials" ||
          code === "auth/too-many-requests"
        ) {
          try {
            const res = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ email: data.email, password: data.password }),
            });
            if (res.ok) {
              const payload = await res.json();
              if (payload.token) {
                localStorage.setItem("auth_token", payload.token);
                localStorage.setItem("auth_user", JSON.stringify(payload));
              }
              window.location.href = "/";
              return;
            } else {
              const errBody = await res.json().catch(() => ({}));
              setLoginError(errBody.message || "Invalid email or password.");
              return;
            }
          } catch (_backendErr) {
            setLoginError("Login failed. Please check your credentials and try again.");
            return;
          }
        }
        setLoginError(error.message || "Login failed. Please try again.");
      } finally {
        setIsLoginSubmitting(false);
      }
    },
    [login, loginSchema]
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
    } catch (error: any) {
      setLoginError(error.message || "Failed to send reset email.");
    } finally {
      setIsLoginSubmitting(false);
    }
  }, [loginForm, resetUserPassword]);

  const getRoleSpecificData = (role: string, data?: any) => {
    const subjectsArray = data?.subjects
      ? data.subjects.split(",").map((s: string) => s.trim())
      : [];
    switch (role) {
      case "student":
        return { grade: data?.grade, board: data?.board, subjects: subjectsArray };
      case "teacher":
        return { school_code: data?.school_code, subjects: subjectsArray };
      case "principal":
      case "school_admin":
        return { school_code: data?.school_code };
      case "parent":
        return { studentId: "student-123" }; // Placeholder
      default:
        return {};
    }
  };

  const onRegisterSubmit = useCallback(
    async (data: z.infer<typeof registerSchema>) => {
      setRegisterError(null);
      setIsRegSubmitting(true);
      try {
        const additionalData = getRoleSpecificData(data.role, data);
        await register(data.email, data.password, data.name, data.role as UserRole, additionalData);
      } catch (error: any) {
        const code = error.code || "";
        const firebaseNotConfigured = error.message === "Firebase is not configured";
        if (firebaseNotConfigured || code === "auth/operation-not-allowed") {
          try {
            const res = await fetch("/api/auth/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                name: data.name,
                email: data.email,
                password: data.password,
                role: data.role,
                grade: data.grade,
                board: data.board,
                school_code: data.school_code,
                subjects: data.subjects,
              }),
            });
            if (res.ok) {
              const payload = await res.json();
              if (payload.token) {
                localStorage.setItem("auth_token", payload.token);
                localStorage.setItem("auth_user", JSON.stringify(payload));
              }
              window.location.href = "/";
              return;
            } else {
              const errBody = await res.json().catch(() => ({}));
              setRegisterError(errBody.message || "Registration failed. Please try again.");
              return;
            }
          } catch (_backendErr) {
            setRegisterError("Registration failed. Please try again later.");
            return;
          }
        }
        setRegisterError(error.message || "Registration failed. Please try again.");
      } finally {
        setIsRegSubmitting(false);
      }
    },
    [register, registerSchema]
  );

  const onRoleSubmit = useCallback(
    async (data: z.infer<typeof roleSchema>) => {
      if (!tempGoogleUser) return;
      try {
        const additionalData = getRoleSpecificData(data.role, data);
        await completeGoogleRegistration(tempGoogleUser, data.role as UserRole, additionalData);
        setIsNewGoogleUser(false);
        setTempGoogleUser(null);
      } catch (error) {
        console.error("Google registration completion failed:", error);
      }
    },
    [tempGoogleUser, completeGoogleRegistration, roleSchema]
  );

  const handleGoogleLogin = useCallback(async () => {
    setGoogleLoading(true);
    setLoginError(null);
    setRegisterError(null);
    try {
      const result = await googleLogin();
      if (result.isNewUser) {
        setIsNewGoogleUser(true);
        setTempGoogleUser(result.user);
      }
    } catch (error: any) {
      const msg = error.message || "Google login failed.";
      if (authTab === "login") setLoginError(msg);
      else setRegisterError(msg);
    } finally {
      setGoogleLoading(false);
    }
  }, [googleLogin, authTab]);

  if (isNewGoogleUser) {
    return (
      <Dialog open={isNewGoogleUser} onOpenChange={(open) => !open && setIsNewGoogleUser(false)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Complete your registration</DialogTitle>
            <DialogDescription>
              Please select your role to complete your registration.
            </DialogDescription>
          </DialogHeader>
          <Form {...roleForm}>
            <form onSubmit={roleForm.handleSubmit(onRoleSubmit)} className="space-y-4 pt-4">
              <FormField
                control={roleForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="principal">Principal</SelectItem>
                        <SelectItem value="school_admin">School Admin</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                        <SelectItem value="parent">Parent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {selectedGoogleRole === "student" && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={roleForm.control}
                    name="grade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grade</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Grade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="9">9th</SelectItem>
                            <SelectItem value="10">10th</SelectItem>
                            <SelectItem value="11">11th</SelectItem>
                            <SelectItem value="12">12th</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={roleForm.control}
                    name="board"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Board</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Board" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="CBSE">CBSE</SelectItem>
                            <SelectItem value="ICSE">ICSE</SelectItem>
                            <SelectItem value="State">State Board</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              {["teacher", "principal", "school_admin"].includes(selectedGoogleRole) && (
                <FormField
                  control={roleForm.control}
                  name="school_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>School Code</FormLabel>
                      <FormControl>
                        <input
                          placeholder="e.g. SCH-1234"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <Button type="submit" className="bg-eduai-primary hover:bg-eduai-accent w-full">
                Complete Registration
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  }

  const inputClasses =
    "w-full rounded-full border border-input bg-card px-5 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:ring-2 focus:ring-ring/20 focus:border-primary";

  return (
    <div className="flex min-h-screen w-full flex-col bg-card font-sans lg:flex-row">
      {/* Mobile: illustration on top */}
      <div className="block h-[300px] lg:hidden">
        <IllustrationPanel />
      </div>

      {/* Left: Login Form */}
      <div className="relative z-50 flex min-h-[calc(100vh-300px)] w-full lg:min-h-screen lg:w-[45%]">
        <div className="pointer-events-auto relative z-50 mx-auto flex h-full w-full max-w-lg flex-col justify-center px-8 py-12 sm:px-12 lg:px-16 xl:px-20">
          <h1 className="font-display text-4xl font-bold text-foreground">
            {authTab === "login" && "Welcome back!"}
            {authTab === "register" && <span className="text-3xl">Create an account</span>}
            {authTab === "forgotPassword" && <span className="text-3xl">Reset Password</span>}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Simplify your workflow and boost your productivity with{" "}
            <span className="font-semibold text-foreground">EduAI</span>.{" "}
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
                      ></path>
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium">Check your email</h3>
                  <p className="text-sm text-muted-foreground">
                    We've sent a password reset link to{" "}
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
                Back to login
              </button>
            </div>
          )}

          {authTab === "login" && (
            <Form {...loginForm}>
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
                          {...field}
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
                            {...field}
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
                    Forgot Password?
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
            </Form>
          )}

          {authTab === "register" && (
            <Form {...registerForm}>
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
                          {...field}
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
                          {...field}
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
                              {...field}
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
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="px-2 text-[10px] text-red-500" />
                      </FormItem>
                    )}
                  />
                </div>
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
                            {...field}
                          >
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                            <option value="principal">Principal</option>
                            <option value="parent">Parent</option>
                          </select>
                        </FormControl>
                        <FormMessage className="px-2 text-[10px] text-red-500" />
                      </FormItem>
                    )}
                  />
                  {registerForm.watch("role") === "student" && (
                    <>
                      <FormField
                        control={registerForm.control}
                        name="grade"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <select
                                disabled={isRegSubmitting}
                                className={inputClasses + " appearance-none py-2.5"}
                                {...field}
                              >
                                <option value="9">9th Grade</option>
                                <option value="10">10th Grade</option>
                                <option value="11">11th Grade</option>
                                <option value="12">12th Grade</option>
                              </select>
                            </FormControl>
                            <FormMessage className="px-2 text-[10px] text-red-500" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="board"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormControl>
                              <select
                                disabled={isRegSubmitting}
                                className={inputClasses + " appearance-none py-2.5"}
                                {...field}
                              >
                                <option value="CBSE">CBSE</option>
                                <option value="ICSE">ICSE</option>
                                <option value="State">State Board</option>
                              </select>
                            </FormControl>
                            <FormMessage className="px-2 text-[10px] text-red-500" />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
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
                              {...field}
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
            </Form>
          )}

          <div className="mb-2 flex items-center gap-4 pt-4">
            <div className="h-px flex-1 bg-border" />
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              or continue with
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="flex items-center justify-center gap-5 pt-2">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || isLoginSubmitting || isRegSubmitting}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted text-foreground transition-all hover:bg-muted/80 active:scale-95"
            >
              {googleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
            </button>
          </div>

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
