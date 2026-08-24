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
    <main className="px-6 py-16">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center">Welcome back</h1>
        <p className="text-gray-400 text-center mt-3">
          Sign in to continue your interview practice.
        </p>

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

          <div>
            <label htmlFor="password" className="block font-semibold mb-2">
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
            {submitting ? "Signing in..." : "Sign In"}
          </button>

          <div className="flex justify-between text-sm">
            <Link
              href="/forgot-password"
              className="text-gray-400 hover:text-blue-400 transition"
            >
              Forgot password?
            </Link>
            <Link
              href="/signup"
              className="text-blue-400 hover:text-blue-300 transition"
            >
              Create account →
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
