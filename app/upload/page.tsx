"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  deleteResume,
  listResumes,
  uploadResume,
  type ResumeSummary,
} from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

const RESUME_ID_STORAGE_KEY = "interview-pressure-resume-id";

export default function UploadPage() {
  const { ready } = useRequireAuth();
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [lastUpload, setLastUpload] = useState<{
    filename: string;
    pages: number;
    preview: string;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadLibrary = useCallback(() => {
    let active = true;

    listResumes()
      .then((data) => {
        if (active) setResumes(data);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (ready) {
      return loadLibrary();
    }
  }, [ready, loadLibrary]);

  if (!ready) {
    return (
      <main className="px-6 py-24 text-center text-muted-text">Loading...</main>
    );
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploading(true);
    setUploadError("");

    try {
      const result = await uploadResume(file);
      sessionStorage.setItem(RESUME_ID_STORAGE_KEY, String(result.id));
      setSelectedId(result.id);
      setLastUpload({
        filename: result.filename,
        pages: result.pages,
        preview: result.text.slice(0, 400),
      });
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Resume could not be processed. Please try again."
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleSelectSaved = (resume: ResumeSummary) => {
    sessionStorage.setItem(RESUME_ID_STORAGE_KEY, String(resume.id));
    setSelectedId(resume.id);
  };

  const handleDeleteResume = async (resumeId: number) => {
    setDeletingId(resumeId);

    try {
      await deleteResume(resumeId);
      setResumes((previous) =>
        previous.filter((item) => item.id !== resumeId)
      );

      if (selectedId === resumeId) {
        sessionStorage.removeItem(RESUME_ID_STORAGE_KEY);
        setSelectedId(null);
      }
    } catch (deleteError) {
      setUploadError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this resume."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const canContinue =
    selectedId !== null &&
    Number(sessionStorage.getItem(RESUME_ID_STORAGE_KEY)) === selectedId;

  return (
    <main className="page-enter px-6 py-12 max-w-3xl mx-auto">
      <p className="text-accent text-sm font-semibold">Step 1 of 2</p>
      <h1 className="text-3xl md:text-4xl font-bold mt-2 tracking-tight">
        Your resume
      </h1>
      <p className="text-secondary-text mt-3">
        Upload a new PDF or pick one you have already uploaded. Text is
        extracted server-side.
      </p>

      {/* Upload dropzone */}
      <div className="mt-10 border-2 border-dashed border-border-s hover:border-accent/40 rounded-2xl p-10 text-center bg-surface/40 transition-all duration-300 group">
        <div className="text-4xl mb-4" aria-hidden>
          📄
        </div>
        <h2 className="text-lg font-semibold text-primary-text">
          Upload your resume
        </h2>
        <p className="text-muted-text text-sm mt-1">
          PDF only · up to 10 MB
        </p>

        <label
          className={`inline-block mt-6 px-7 py-3 rounded-xl cursor-pointer font-semibold transition-all duration-200 ${
            uploading
              ? "bg-accent/40 cursor-not-allowed text-accent/70"
              : "bg-accent hover:bg-accent-hover shadow-lg shadow-accent/10 hover:shadow-accent/20"
          }`}
        >
          {uploading ? "Reading your resume..." : "Choose PDF"}

          <input
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            disabled={uploading}
            onChange={handleUpload}
          />
        </label>

        {uploading && (
          <p className="mt-4 text-sm text-accent" role="status">
            Uploading and extracting text...
          </p>
        )}

        {uploadError && (
          <div
            role="alert"
            className="mt-5 bg-danger/5 border border-danger/20 text-danger text-sm rounded-xl px-4 py-3 inline-block max-w-full"
          >
            {uploadError}
          </div>
        )}
      </div>

      {lastUpload && (
        <div className="mt-8 bg-surface border border-success/20 rounded-2xl p-6">
          <p className="text-success font-semibold flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-success/10 text-sm">
              ✓
            </span>
            Resume processed
          </p>
          <p className="text-secondary-text mt-3">
            {lastUpload.filename} · {lastUpload.pages} page
            {lastUpload.pages === 1 ? "" : "s"}
          </p>

          {lastUpload.preview && (
            <>
              <p className="text-xs text-muted-text uppercase tracking-wide mt-5 mb-2 font-semibold">
                Extracted text preview
              </p>
              <pre className="whitespace-pre-wrap break-words text-sm text-secondary-text bg-base border border-border-s rounded-xl p-4 max-h-48 overflow-y-auto leading-relaxed">
                {lastUpload.preview}
                {lastUpload.preview.length >= 400 ? "\n…" : ""}
              </pre>
            </>
          )}
        </div>
      )}

      {resumes.length > 0 && (
        <section aria-labelledby="saved-resumes-heading" className="mt-10">
          <h2
            id="saved-resumes-heading"
            className="text-xl font-bold mb-4 tracking-tight"
          >
            Saved resumes
          </h2>

          <ul className="space-y-3">
            {resumes.map((resume) => (
              <li key={resume.id}>
                <div
                  className={`rounded-2xl border p-4 flex items-center gap-4 transition-all duration-200 ${
                    selectedId === resume.id
                      ? "border-accent/40 bg-accent/5"
                      : "border-border-s bg-surface/60 hover:border-border-d"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectSaved(resume)}
                    className="flex-1 min-w-0 text-left"
                    aria-pressed={selectedId === resume.id}
                  >
                    <p className="font-semibold truncate text-primary-text">
                      {resume.filename}
                    </p>
                    <p className="text-muted-text text-xs mt-1 truncate">
                      {resume.pages} page{resume.pages === 1 ? "" : "s"} ·{" "}
                      {new Date(resume.uploaded_at).toLocaleDateString()}
                    </p>
                  </button>

                  {selectedId === resume.id && (
                    <span className="text-accent text-xs font-semibold shrink-0">
                      Selected ✓
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleDeleteResume(resume.id)}
                    disabled={deletingId === resume.id}
                    aria-label={`Delete ${resume.filename}`}
                    className="border border-border-s hover:border-danger/40 hover:text-danger hover:bg-danger/5 text-muted-text text-xs font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50 transition-all duration-200 shrink-0"
                  >
                    {deletingId === resume.id ? "..." : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canContinue && (
        <div className="mt-10 text-center">
          <Link
            href="/job-details"
            className="group inline-block w-full sm:w-auto bg-accent hover:bg-accent-hover px-10 py-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg shadow-accent/10 hover:shadow-accent/20"
          >
            Continue to Job Details
            <span className="inline-block ml-1 transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
      )}
    </main>
  );
}
