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
      <main className="px-6 py-24 text-center text-muted-text">
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
    <main className="page-enter px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Profile</h1>

      <div className="mt-10 bg-surface border border-border-s rounded-2xl p-8 shadow-lg shadow-black/20">
        <dl className="grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-muted-text">Name</dt>
            <dd className="font-semibold mt-1 text-primary-text">
              {user.name}
            </dd>
          </div>
          <div>
            <dt className="text-muted-text">Email</dt>
            <dd className="font-semibold mt-1 break-all text-primary-text">
              {user.email}
            </dd>
          </div>
          <div>
            <dt className="text-muted-text">Member since</dt>
            <dd className="font-semibold mt-1 text-primary-text">
              {new Date(user.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-muted-text mt-5">
          Email changes require a verification flow which is not part of this
          local build — your email is fixed here.
        </p>
      </div>

      <section
        aria-labelledby="update-name-heading"
        className="mt-8 bg-surface border border-border-s rounded-2xl p-8 shadow-lg shadow-black/20"
      >
        <h2
          id="update-name-heading"
          className="text-xl font-bold tracking-tight"
        >
          Update name
        </h2>

        <form onSubmit={handleSaveName} noValidate className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="profile-name"
              className="block font-semibold mb-2 text-sm text-secondary-text"
            >
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
              className="w-full bg-base border border-border-s rounded-xl px-4 py-3 text-primary-text placeholder-muted-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200"
            />
          </div>

          {nameError && (
            <p role="alert" className="text-sm text-danger">
              {nameError}
            </p>
          )}

          {nameSaved && (
            <p className="text-sm text-success">✓ Name updated.</p>
          )}

          <button
            type="submit"
            disabled={savingName || !effectiveName.trim()}
            className="bg-accent hover:bg-accent-hover disabled:opacity-60 px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-accent/10 hover:shadow-accent/20"
          >
            {savingName ? "Saving..." : "Save Name"}
          </button>
        </form>
      </section>

      <section
        aria-labelledby="change-password-heading"
        className="mt-8 bg-surface border border-border-s rounded-2xl p-8 shadow-lg shadow-black/20"
      >
        <h2
          id="change-password-heading"
          className="text-xl font-bold tracking-tight"
        >
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
              className="block font-semibold mb-2 text-sm text-secondary-text"
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
              className="w-full bg-base border border-border-s rounded-xl px-4 py-3 text-primary-text placeholder-muted-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="new-profile-password"
                className="block font-semibold mb-2 text-sm text-secondary-text"
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
                className="w-full bg-base border border-border-s rounded-xl px-4 py-3 text-primary-text placeholder-muted-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-new-profile-password"
                className="block font-semibold mb-2 text-sm text-secondary-text"
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
                className="w-full bg-base border border-border-s rounded-xl px-4 py-3 text-primary-text placeholder-muted-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200"
              />
            </div>
          </div>

          {passwordError && (
            <p role="alert" className="text-sm text-danger">
              {passwordError}
            </p>
          )}

          {passwordMessage && (
            <p className="text-sm text-success">{passwordMessage}</p>
          )}

          <button
            type="submit"
            disabled={
              savingPassword ||
              !currentPassword ||
              !newPassword ||
              !confirmNewPassword
            }
            className="bg-accent hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-accent/10 hover:shadow-accent/20"
          >
            {savingPassword ? "Updating..." : "Update Password"}
          </button>
        </form>
      </section>

      <section className="mt-8 bg-surface border border-border-s rounded-2xl p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-black/20">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Session</h2>
          <p className="text-muted-text text-sm mt-1">
            Sign out of InterviewPressure on this device.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="border border-border-d hover:bg-white/5 hover:text-primary-text px-6 py-3 rounded-xl font-semibold transition-all duration-200 text-secondary-text shrink-0"
        >
          Log out
        </button>
      </section>
    </main>
  );
}
