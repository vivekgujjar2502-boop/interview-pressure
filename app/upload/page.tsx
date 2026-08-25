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
      .catch(() => {
        // Library is optional; upload still works.
      });

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
      <main className="px-6 py-24 text-center text-gray-500">
        Loading...
      </main>
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
    <main className="px-6 py-12 max-w-3xl mx-auto">
      <p className="text-blue-500 text-sm font-semibold">Step 1 of 2</p>
      <h1 className="text-3xl md:text-4xl font-bold mt-2">Your resume</h1>
      <p className="text-gray-400 mt-3">
        Upload a new PDF or pick one you have already uploaded. Text is
        extracted server-side using pdf.js.
      </p>

      <div className="mt-10 border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-2xl p-10 text-center bg-gray-950 transition">
        <div className="text-4xl mb-4" aria-hidden>
          📄
        </div>
        <h2 className="text-lg font-semibold">Upload your resume</h2>
        <p className="text-gray-500 text-sm mt-1">
          PDF only · up to 10 MB
        </p>

        <label
          className={`inline-block mt-6 px-7 py-3 rounded-xl cursor-pointer font-semibold transition ${
            uploading
              ? "bg-blue-600/50 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
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
          <p className="mt-4 text-sm text-blue-400" role="status">
            Uploading and extracting text...
          </p>
        )}

        {uploadError && (
          <p role="alert" className="mt-5 text-sm text-red-400">
            {uploadError}
          </p>
        )}
      </div>

      {lastUpload && (
        <div className="mt-8 bg-gray-950 border border-green-500/30 rounded-2xl p-6">
          <p className="text-green-400 font-semibold">
            ✓ Resume processed
          </p>
          <p className="text-gray-300 mt-2">
            {lastUpload.filename} · {lastUpload.pages} page
            {lastUpload.pages === 1 ? "" : "s"}
          </p>

          {lastUpload.preview && (
            <>
              <p className="text-xs text-gray-500 uppercase tracking-wide mt-4 mb-2">
                Extracted text preview
              </p>
              <pre className="whitespace-pre-wrap break-words text-sm text-gray-300 bg-black border border-gray-800 rounded-xl p-4 max-h-48 overflow-y-auto leading-6">
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
            className="text-xl font-bold mb-4"
          >
            Saved resumes
          </h2>

          <ul className="space-y-3">
            {resumes.map((resume) => (
              <li key={resume.id}>
                <div
                  className={`rounded-2xl border p-4 flex items-center gap-4 transition ${
                    selectedId === resume.id
                      ? "border-blue-500 bg-blue-500/5"
                      : "border-gray-800 bg-gray-950 hover:border-gray-600"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectSaved(resume)}
                    className="flex-1 min-w-0 text-left"
                    aria-pressed={selectedId === resume.id}
                  >
                    <p className="font-semibold truncate">{resume.filename}</p>
                    <p className="text-gray-500 text-xs mt-1 truncate">
                      {resume.pages} page{resume.pages === 1 ? "" : "s"} ·{" "}
                      {new Date(resume.uploaded_at).toLocaleDateString()}
                    </p>
                  </button>

                  {selectedId === resume.id && (
                    <span className="text-blue-400 text-xs font-semibold shrink-0">
                      Selected ✓
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleDeleteResume(resume.id)}
                    disabled={deletingId === resume.id}
                    aria-label={`Delete ${resume.filename}`}
                    className="border border-gray-800 hover:border-red-500/50 hover:text-red-400 text-gray-500 text-xs font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50 transition shrink-0"
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
            className="inline-block w-full sm:w-auto bg-blue-600 hover:bg-blue-700 px-10 py-4 rounded-xl font-semibold text-lg transition"
          >
            Continue to Job Details →
          </Link>
        </div>
      )}
    </main>
  );
}
