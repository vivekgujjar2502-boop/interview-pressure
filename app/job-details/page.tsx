"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createJob } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type ExperienceLevel =
  | "Fresher"
  | "0–1 Years"
  | "1–2 Years"
  | "2–5 Years"
  | "5+ Years";

const EXPERIENCE_LEVELS: { value: ExperienceLevel; hint: string }[] = [
  { value: "Fresher", hint: "Student or recent graduate" },
  { value: "0–1 Years", hint: "Early career" },
  { value: "1–2 Years", hint: "Junior developer" },
  { value: "2–5 Years", hint: "Mid-level developer" },
  { value: "5+ Years", hint: "Senior developer" },
];

const JOB_ID_STORAGE_KEY = "interview-pressure-job-id";
const RESUME_ID_STORAGE_KEY = "interview-pressure-resume-id";

export default function JobDetailsPage() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const [jobRole, setJobRole] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [experienceLevel, setExperienceLevel] =
    useState<ExperienceLevel>("Fresher");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!ready) {
    return (
      <main className="px-6 py-24 text-center text-muted-text">Loading...</main>
    );
  }

  const resumeSelected = Boolean(
    sessionStorage.getItem(RESUME_ID_STORAGE_KEY)
  );

  const handleRoleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setJobRole(event.target.value);
    if (error) setError("");
  };

  const handleContinue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedRole = jobRole.trim();
    if (!trimmedRole) {
      setError("Please enter your target job role.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const job = await createJob({
        role: trimmedRole,
        company: company.trim(),
        experience: experienceLevel,
        description: description.trim(),
      });
      sessionStorage.setItem(JOB_ID_STORAGE_KEY, String(job.id));
      router.push("/interview");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save the job details. Please try again."
      );
      setSubmitting(false);
    }
  };

  return (
    <main className="page-enter px-6 py-12 max-w-3xl mx-auto">
      <p className="text-accent text-sm font-semibold">Step 2 of 2</p>
      <h1 className="text-3xl md:text-4xl font-bold mt-2 tracking-tight">
        Job details
      </h1>
      <p className="text-secondary-text mt-3">
        Tell us what you are preparing for, so your AI interviewer asks the
        right questions.
      </p>

      {!resumeSelected ? (
        <div className="mt-10 bg-surface border border-warning/20 rounded-2xl p-6 text-center">
          <p className="text-warning font-semibold">No resume selected yet</p>
          <p className="text-secondary-text text-sm mt-2">
            Pick or upload a resume first so questions can be personalized.
          </p>
          <Link
            href="/upload"
            className="inline-block mt-5 border border-border-d hover:bg-white/5 px-6 py-3 rounded-xl font-semibold text-sm text-secondary-text hover:text-primary-text transition-all duration-200"
          >
            ← Back to Resume
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-6 inline-flex items-center gap-2 bg-success/5 border border-success/20 text-success rounded-xl px-4 py-2 text-sm font-medium">
            ✓ Resume selected
          </p>

          <form
            onSubmit={handleContinue}
            noValidate
            className="mt-8 bg-surface border border-border-s rounded-2xl p-8 shadow-lg shadow-black/20"
          >
            <label
              htmlFor="job-role"
              className="block text-sm font-semibold text-secondary-text mb-2"
            >
              Target Job Role <span className="text-danger">*</span>
            </label>

            <input
              id="job-role"
              type="text"
              required
              value={jobRole}
              onChange={handleRoleChange}
              placeholder="e.g. Frontend Developer"
              aria-invalid={Boolean(error)}
              className={`w-full bg-base border rounded-xl px-4 py-3 text-primary-text placeholder-muted-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 ${
                error ? "border-danger/50" : "border-border-s"
              }`}
            />

            {error && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {error}
              </p>
            )}

            <label
              htmlFor="company"
              className="block text-sm font-semibold text-secondary-text mb-2 mt-6"
            >
              Target Company{" "}
              <span className="text-muted-text font-normal">(optional)</span>
            </label>

            <input
              id="company"
              type="text"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="e.g. Google"
              className="w-full bg-base border border-border-s rounded-xl px-4 py-3 text-primary-text placeholder-muted-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200"
            />

            <label
              htmlFor="description"
              className="block text-sm font-semibold text-secondary-text mb-2 mt-6"
            >
              Job Description{" "}
              <span className="text-muted-text font-normal">(optional)</span>
            </label>

            <textarea
              id="description"
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Paste key responsibilities or requirements to sharpen your questions..."
              className="w-full bg-base border border-border-s rounded-xl px-4 py-3 text-primary-text placeholder-muted-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 resize-y"
            />

            <fieldset className="mt-8">
              <legend className="text-sm font-semibold text-secondary-text mb-3">
                Experience Level
              </legend>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {EXPERIENCE_LEVELS.map((level) => {
                  const isSelected = experienceLevel === level.value;

                  return (
                    <label
                      key={level.value}
                      className={`cursor-pointer rounded-xl border p-4 text-center transition-all duration-200 ${
                        isSelected
                          ? "border-accent/40 bg-accent/5"
                          : "border-border-s bg-base hover:border-border-d"
                      }`}
                    >
                      <input
                        type="radio"
                        name="experience-level"
                        value={level.value}
                        checked={isSelected}
                        onChange={() => setExperienceLevel(level.value)}
                        className="sr-only"
                      />

                      <span
                        aria-hidden
                        className={`block w-4 h-4 rounded-full border-2 mx-auto mb-3 transition-all duration-200 ${
                          isSelected
                            ? "border-accent bg-accent"
                            : "border-border-d"
                        }`}
                      />

                      <span className="block font-semibold text-sm text-primary-text">
                        {level.value}
                      </span>
                      <span className="block text-xs text-muted-text mt-1">
                        {level.hint}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={submitting || !resumeSelected}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 mt-10 shadow-lg shadow-accent/10 hover:shadow-accent/20"
            >
              {submitting ? "Creating interview..." : "Start Interview →"}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
