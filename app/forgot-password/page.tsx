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
    <main className="px-6 py-16">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center">Forgot password</h1>
        <p className="text-gray-400 text-center mt-3">
          Enter your account email to start a password reset.
        </p>

        {!done ? (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="mt-10 bg-gray-950 border border-gray-800 rounded-2xl p-8 space-y-6"
          >
            <div>
              <label htmlFor="email" className="block font-semibold mb-2">
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
                className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed px-8 py-4 rounded-xl font-semibold transition"
            >
              {submitting ? "Processing..." : "Request Reset"}
            </button>

            <p className="text-sm text-center text-gray-400">
              Remembered it?{" "}
              <Link
                href="/login"
                className="text-blue-400 hover:text-blue-300 transition"
              >
                Sign in
              </Link>
            </p>
          </form>
        ) : (
          <div className="mt-10 bg-gray-950 border border-gray-800 rounded-2xl p-8 space-y-5">
            <p className="text-gray-300">{message}</p>

            {devToken && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm space-y-3">
                <p className="text-blue-200">
                  Development mode is enabled, so your reset token is:
                </p>
                <code className="block break-all text-xs bg-black border border-gray-800 rounded-lg px-3 py-2 text-blue-300">
                  {devToken}
                </code>
                <Link
                  href={`/reset-password?token=${encodeURIComponent(devToken)}`}
                  className="inline-block bg-blue-600 hover:bg-blue-700 px-5 py-3 rounded-xl font-semibold transition"
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
