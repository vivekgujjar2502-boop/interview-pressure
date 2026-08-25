"use client";

import Link from "next/link";
import { useState } from "react";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const result = await forgotPassword(email.trim());
      setDone(true);
      setMessage(result.message);
      setDevToken(result.dev_reset_token);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not process the request. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page-enter px-6 py-20">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center tracking-tight">
          Forgot password
        </h1>
        <p className="text-secondary-text text-center mt-3">
          Enter your account email to start a password reset.
        </p>

        {!done ? (
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
              {submitting ? "Processing..." : "Request Reset"}
            </button>

            <p className="text-sm text-center text-secondary-text">
              Remembered it?{" "}
              <Link
                href="/login"
                className="text-accent hover:text-accent-hover transition-colors duration-200"
              >
                Sign in
              </Link>
            </p>
          </form>
        ) : (
          <div className="mt-10 bg-surface border border-border-s rounded-2xl p-8 space-y-5 shadow-lg shadow-black/20">
            <p className="text-primary-text">{message}</p>

            {devToken && (
              <div className="bg-accent/5 border border-accent/15 rounded-xl p-5 text-sm space-y-3">
                <p className="text-accent font-medium">
                  Development mode is enabled, so your reset token is:
                </p>
                <code className="block break-all text-xs bg-base border border-border-s rounded-lg px-3 py-2 text-accent font-mono">
                  {devToken}
                </code>
                <Link
                  href={`/reset-password?token=${encodeURIComponent(devToken)}`}
                  className="inline-block bg-accent hover:bg-accent-hover px-5 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-accent/10"
                >
                  Continue to Reset →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
