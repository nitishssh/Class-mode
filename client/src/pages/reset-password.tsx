import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, CheckCircle2, XCircle } from "lucide-react";
import { motion } from "framer-motion";

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Za-z]/, "Must contain at least one letter")
      .regex(/\d/, "Must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ResetFormValues = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "invalid" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t || t.length < 10) {
      setStatus("invalid");
      setErrorMsg("The reset link is missing or malformed. Please request a new one.");
    } else {
      setToken(t);
    }
  }, []);

  const onSubmit = async (data: ResetFormValues) => {
    if (!token) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Password reset failed");
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-indigo-950 via-violet-900 to-purple-950 p-4">
      {/* Ambient glows */}
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
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-2xl">
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

          <div className="px-8 pb-10 pt-8">
            {/* Icon */}
            <motion.div
              className="mb-6 flex justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
                <Lock className="h-7 w-7 text-white" />
              </div>
            </motion.div>

            {/* ── Success state ── */}
            {status === "success" && (
              <div className="text-center">
                <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-400" />
                <h1 className="text-2xl font-black text-white">Password Updated!</h1>
                <p className="mt-3 text-sm leading-relaxed text-white/60">
                  Your password has been reset successfully. You can now log in with your new
                  password.
                </p>
                <button
                  onClick={() => setLocation("/login")}
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-indigo-400 hover:to-violet-500 active:scale-[0.98]"
                >
                  Go to Login
                </button>
              </div>
            )}

            {/* ── Invalid link state ── */}
            {status === "invalid" && (
              <div className="text-center">
                <XCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
                <h1 className="text-2xl font-black text-white">Invalid Link</h1>
                <p className="mt-3 text-sm leading-relaxed text-white/60">{errorMsg}</p>
                <button
                  onClick={() => setLocation("/login")}
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/70 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-[0.98]"
                >
                  Back to Login
                </button>
              </div>
            )}

            {/* ── Form state (idle / loading / error) ── */}
            {(status === "idle" || status === "loading" || status === "error") && (
              <>
                <h1 className="text-center text-2xl font-black tracking-tight text-white">
                  Set New Password
                </h1>
                <p className="mt-2 text-center text-sm leading-relaxed text-white/60">
                  Choose a strong password — at least 8 characters with a letter and a number.
                </p>

                <form className="mt-8 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                  {status === "error" && (
                    <motion.div
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {errorMsg}
                    </motion.div>
                  )}

                  <div>
                    <input
                      type="password"
                      placeholder="New password"
                      autoComplete="new-password"
                      disabled={status === "loading"}
                      className="w-full rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-sm text-white outline-none transition-all placeholder:text-white/40 focus:border-indigo-400 focus:bg-indigo-500/10 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                      {...form.register("password")}
                    />
                    {form.formState.errors.password && (
                      <p className="mt-1.5 px-1 text-xs text-red-400">
                        {form.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                      disabled={status === "loading"}
                      className="w-full rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-sm text-white outline-none transition-all placeholder:text-white/40 focus:border-indigo-400 focus:bg-indigo-500/10 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                      {...form.register("confirmPassword")}
                    />
                    {form.formState.errors.confirmPassword && (
                      <p className="mt-1.5 px-1 text-xs text-red-400">
                        {form.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all duration-150 hover:from-indigo-400 hover:to-violet-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
                    {status === "loading" ? "Resetting..." : "Reset Password"}
                  </button>
                </form>

                <button
                  type="button"
                  className="mt-6 w-full text-center text-sm text-white/40 transition-colors hover:text-white/70"
                  onClick={() => setLocation("/login")}
                >
                  Back to Login
                </button>
              </>
            )}

            <p className="mt-8 text-center text-xs italic text-white/20">
              "The secret of getting ahead is getting started."
            </p>
            <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-widest text-white/15">
              — Mark Twain
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
