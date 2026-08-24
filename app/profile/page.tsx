"use client";

import { useState } from "react";
import { changePassword, updateProfile } from "@/lib/api";
import { useAuth, useRequireAuth } from "@/lib/auth";

export default function ProfilePage() {
  const { ready, user } = useRequireAuth();
  const { signOut, refreshUser } = useAuth();

  const [name, setName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  if (!ready || !user) {
    return (
      <main className="px-6 py-24 text-center text-gray-500">
        Loading your profile...
      </main>
    );
  }

  const effectiveName = name || user.name;

  const handleSaveName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingName(true);
    setNameError("");
    setNameSaved(false);

    try {
      await updateProfile({ name: effectiveName.trim() });
      refreshUser();
      setNameSaved(true);
      setName("");
    } catch (saveError) {
      setNameError(
        saveError instanceof Error
          ? saveError.message
          : "Could not update your name."
      );
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordError("");
    setPasswordMessage("");

    try {
      const result = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_new_password: confirmNewPassword,
      });

      localStorage.setItem("interview-pressure-token", result.token);
      setPasswordMessage("Password updated. Other sessions were signed out.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (changeError) {
      setPasswordError(
        changeError instanceof Error
          ? changeError.message
          : "Could not change your password."
      );
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <main className="px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold">Profile</h1>

      <div className="mt-10 bg-gray-950 border border-gray-800 rounded-2xl p-8">
        <dl className="grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-gray-500">Name</dt>
            <dd className="font-semibold mt-1">{user.name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Email</dt>
            <dd className="font-semibold mt-1 break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Member since</dt>
            <dd className="font-semibold mt-1">
              {new Date(user.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-gray-600 mt-5">
          Email changes require a verification flow which is not part of this
          local build — your email is fixed here.
        </p>
      </div>

      <section
        aria-labelledby="update-name-heading"
        className="mt-8 bg-gray-950 border border-gray-800 rounded-2xl p-8"
      >
        <h2 id="update-name-heading" className="text-xl font-bold">
          Update name
        </h2>

        <form onSubmit={handleSaveName} noValidate className="mt-5 space-y-4">
          <div>
            <label htmlFor="profile-name" className="block font-semibold mb-2">
              Display name
            </label>
            <input
              id="profile-name"
              type="text"
              value={effectiveName}
              onChange={(event) => {
                setName(event.target.value);
                setNameSaved(false);
              }}
              className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {nameError && (
            <p role="alert" className="text-sm text-red-400">
              {nameError}
            </p>
          )}

          {nameSaved && (
            <p className="text-sm text-green-400">✓ Name updated.</p>
          )}

          <button
            type="submit"
            disabled={savingName || !effectiveName.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-6 py-3 rounded-xl font-semibold transition"
          >
            {savingName ? "Saving..." : "Save Name"}
          </button>
        </form>
      </section>

      <section
        aria-labelledby="change-password-heading"
        className="mt-8 bg-gray-950 border border-gray-800 rounded-2xl p-8"
      >
        <h2 id="change-password-heading" className="text-xl font-bold">
          Change password
        </h2>

        <form
          onSubmit={handleChangePassword}
          noValidate
          className="mt-5 space-y-4"
        >
          <div>
            <label
              htmlFor="current-password"
              className="block font-semibold mb-2"
            >
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="new-profile-password"
                className="block font-semibold mb-2"
              >
                New password
              </label>
              <input
                id="new-profile-password"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-new-profile-password"
                className="block font-semibold mb-2"
              >
                Confirm new password
              </label>
              <input
                id="confirm-new-profile-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
                className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          {passwordError && (
            <p role="alert" className="text-sm text-red-400">
              {passwordError}
            </p>
          )}

          {passwordMessage && (
            <p className="text-sm text-green-400">{passwordMessage}</p>
          )}

          <button
            type="submit"
            disabled={
              savingPassword ||
              !currentPassword ||
              !newPassword ||
              !confirmNewPassword
            }
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition"
          >
            {savingPassword ? "Updating..." : "Update Password"}
          </button>
        </form>
      </section>

      <section className="mt-8 bg-gray-950 border border-gray-800 rounded-2xl p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Session</h2>
          <p className="text-gray-500 text-sm mt-1">
            Sign out of InterviewPressure on this device.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="border border-gray-700 hover:bg-gray-900 px-6 py-3 rounded-xl font-semibold transition shrink-0"
        >
          Log out
        </button>
      </section>
    </main>
  );
}
