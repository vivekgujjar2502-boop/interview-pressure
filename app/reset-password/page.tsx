"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { resetPassword } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await resetPassword({
        token: token.trim(),
        new_password: password,
        confirm_new_password: confirmPassword,
      });
      setDone(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not reset the password. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="mt-10 bg-surface border border-border-s rounded-2xl p-8 text-center space-y-5 shadow-lg shadow-black/20">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/10 border border-success/20">
          <span className="text-success text-lg">✓</span>
        </div>
        <p className="text-success font-semibold">Password updated</p>
        <p className="text-secondary-text text-sm">
          Your old sessions were signed out. Sign in with your new password.
        </p>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="w-full bg-accent hover:bg-accent-hover px-8 py-3.5 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-accent/10 hover:shadow-accent/20"
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-10 bg-surface border border-border-s rounded-2xl p-8 space-y-6 shadow-lg shadow-black/20"
    >
      <div>
        <label
          htmlFor="token"
          className="block text-sm font-semibold text-secondary-text mb-2"
        >
          Reset token
        </label>
        <input
          id="token"
          type="text"
          required
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Paste your reset token"
          className="w-full bg-base border border-border-s rounded-xl px-4 py-3 font-mono text-sm text-primary-text placeholder-muted-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200"
        />
      </div>

      <div>
        <label
          htmlFor="new-password"
          className="block text-sm font-semibold text-secondary-text mb-2"
        >
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          aria-describedby="reset-password-hint"
          className="w-full bg-base border border-border-s rounded-xl px-4 py-3 text-primary-text placeholder-muted-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200"
        />
        <p id="reset-password-hint" className="text-xs text-muted-text mt-2">
          Minimum 8 characters with at least one letter and one number.
        </p>
      </div>

      <div>
        <label
          htmlFor="confirm-new-password"
          className="block text-sm font-semibold text-secondary-text mb-2"
        >
          Confirm new password
        </label>
        <input
          id="confirm-new-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Repeat your new password"
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
        {submitting ? "Updating..." : "Update Password"}
      </button>

      <p className="text-sm text-center text-secondary-text">
        Need a new token?{" "}
        <Link
          href="/forgot-password"
          className="text-accent hover:text-accent-hover transition-colors duration-200"
        >
          Request a reset
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="page-enter px-6 py-20">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center tracking-tight">
          Choose a new password
        </h1>

        <Suspense
          fallback={
            <p className="mt-10 text-center text-muted-text">
              Loading form...
            </p>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
