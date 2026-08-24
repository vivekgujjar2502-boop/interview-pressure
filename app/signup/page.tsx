"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export default function SignupPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
      });
      router.push("/dashboard");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not create your account. Please try again."
      );
      setSubmitting(false);
    }
  };

  return (
    <main className="px-6 py-16">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center">Create your account</h1>
        <p className="text-gray-400 text-center mt-3">
          Track progress across every mock interview you run.
        </p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-10 bg-gray-950 border border-gray-800 rounded-2xl p-8 space-y-6"
        >
          <div>
            <label htmlFor="name" className="block font-semibold mb-2">
              Full name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Alex Chen"
              className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

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
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              aria-describedby="password-hint"
              className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
            <p id="password-hint" className="text-xs text-gray-500 mt-2">
              Minimum 8 characters with at least one letter and one number.
            </p>
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block font-semibold mb-2"
            >
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat your password"
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
            {submitting ? "Creating account..." : "Create Account"}
          </button>

          <p className="text-sm text-center text-gray-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-blue-400 hover:text-blue-300 transition"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
