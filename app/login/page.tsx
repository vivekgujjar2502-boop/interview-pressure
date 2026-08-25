"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await signIn(email.trim(), password);
      router.push("/dashboard");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not sign in. Please try again."
      );
      setSubmitting(false);
    }
  };

  return (
    <main className="page-enter px-6 py-20">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center tracking-tight">
          Welcome back
        </h1>
        <p className="text-secondary-text text-center mt-3">
          Sign in to continue your interview practice.
        </p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-10 bg-surface border border-border-s rounded-2xl p-8 space-y-6 shadow-lg shadow-black/20"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-secondary-text mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full bg-base border border-border-s rounded-xl px-4 py-3 text-primary-text placeholder-muted-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-secondary-text mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="w-full bg-base border border-border-s rounded-xl px-4 py-3 text-primary-text placeholder-muted-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="bg-danger/5 border border-danger/20 text-danger text-sm rounded-xl px-4 py-3"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed px-8 py-3.5 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-accent/10 hover:shadow-accent/20"
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>

          <div className="flex justify-between text-sm pt-1">
            <Link
              href="/forgot-password"
              className="text-muted-text hover:text-accent transition-colors duration-200"
            >
              Forgot password?
            </Link>
            <Link
              href="/signup"
              className="text-accent hover:text-accent-hover transition-colors duration-200"
            >
              Create account →
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
