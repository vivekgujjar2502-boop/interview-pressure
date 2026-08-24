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
      <div className="mt-10 bg-gray-950 border border-gray-800 rounded-2xl p-8 text-center space-y-5">
        <p className="text-green-400 font-semibold">✓ Password updated</p>
        <p className="text-gray-400 text-sm">
          Your old sessions were signed out. Sign in with your new password.
        </p>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="w-full bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-xl font-semibold transition"
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
      className="mt-10 bg-gray-950 border border-gray-800 rounded-2xl p-8 space-y-6"
    >
      <div>
        <label htmlFor="token" className="block font-semibold mb-2">
          Reset token
        </label>
        <input
          id="token"
          type="text"
          required
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Paste your reset token"
          className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 font-mono text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
        />
      </div>

      <div>
        <label htmlFor="new-password" className="block font-semibold mb-2">
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
          className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
        />
        <p id="reset-password-hint" className="text-xs text-gray-500 mt-2">
          Minimum 8 characters with at least one letter and one number.
        </p>
      </div>

      <div>
        <label
          htmlFor="confirm-new-password"
          className="block font-semibold mb-2"
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
        {submitting ? "Updating..." : "Update Password"}
      </button>

      <p className="text-sm text-center text-gray-400">
        Need a new token?{" "}
        <Link
          href="/forgot-password"
          className="text-blue-400 hover:text-blue-300 transition"
        >
          Request a reset
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="px-6 py-16">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center">Choose a new password</h1>

        <Suspense
          fallback={
            <p className="mt-10 text-center text-gray-500">Loading form...</p>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
