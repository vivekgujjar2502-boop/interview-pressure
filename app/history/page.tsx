"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteInterview,
  listInterviews,
  type InterviewSummary,
} from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function HistoryPage() {
  const { ready } = useRequireAuth();
  const [interviews, setInterviews] = useState<InterviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [minScore, setMinScore] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "score">(
    "newest"
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchInterviews = useCallback(
    () =>
      listInterviews()
        .then((data) => {
          setInterviews(data);
          setError("");
        })
        .catch((loadError) => {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load your interview history."
          );
        })
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    if (ready) {
      void fetchInterviews();
    }
  }, [ready, fetchInterviews]);

  const visible = useMemo(() => {
    let filtered = interviews.filter((interview) => {
      if (
        roleFilter &&
        !interview.role.toLowerCase().includes(roleFilter.toLowerCase())
      ) {
        return false;
      }

      if (
        companyFilter &&
        !interview.company
          .toLowerCase()
          .includes(companyFilter.toLowerCase())
      ) {
        return false;
      }

      if (minScore && (interview.score ?? -1) < Number(minScore)) {
        return false;
      }

      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      if (sortOrder === "score") {
        return (b.score ?? -1) - (a.score ?? -1);
      }

      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();

      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });

    return filtered;
  }, [interviews, roleFilter, companyFilter, minScore, sortOrder]);

  const handleDelete = async (interviewId: number) => {
    setDeletingId(interviewId);

    try {
      await deleteInterview(interviewId);
      setInterviews((previous) =>
        previous.filter((item) => item.id !== interviewId)
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this interview."
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (!ready) {
    return (
      <main className="px-6 py-24 text-center text-muted-text">
        Loading your history...
      </main>
    );
  }

  return (
    <main className="page-enter px-6 py-12 max-w-5xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        Interview history
      </h1>
      <p className="text-secondary-text mt-3">
        Every mock interview you have completed, with scores and feedback.
      </p>

      <div className="mt-8 bg-surface/60 border border-border-s rounded-2xl p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label
            htmlFor="filter-role"
            className="text-xs text-muted-text block mb-2 font-semibold"
          >
            Role contains
          </label>
          <input
            id="filter-role"
            type="text"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            placeholder="e.g. Backend"
            className="w-full bg-base border border-border-s rounded-xl px-3 py-2.5 text-sm placeholder-muted-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200"
          />
        </div>

        <div>
          <label
            htmlFor="filter-company"
            className="text-xs text-muted-text block mb-2 font-semibold"
          >
            Company contains
          </label>
          <input
            id="filter-company"
            type="text"
            value={companyFilter}
            onChange={(event) => setCompanyFilter(event.target.value)}
            placeholder="e.g. Google"
            className="w-full bg-base border border-border-s rounded-xl px-3 py-2.5 text-sm placeholder-muted-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200"
          />
        </div>

        <div>
          <label
            htmlFor="filter-score"
            className="text-xs text-muted-text block mb-2 font-semibold"
          >
            Minimum score
          </label>
          <input
            id="filter-score"
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={minScore}
            onChange={(event) => setMinScore(event.target.value)}
            placeholder="e.g. 6"
            className="w-full bg-base border border-border-s rounded-xl px-3 py-2.5 text-sm placeholder-muted-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200"
          />
        </div>

        <div>
          <label
            htmlFor="sort-order"
            className="text-xs text-muted-text block mb-2 font-semibold"
          >
            Sort by
          </label>
          <select
            id="sort-order"
            value={sortOrder}
            onChange={(event) =>
              setSortOrder(event.target.value as typeof sortOrder)
            }
            className="w-full bg-base border border-border-s rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="score">Highest score</option>
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-6 text-sm text-danger">
          {error}
        </p>
      )}

      {loading && (
        <p className="mt-10 text-muted-text">Loading interviews...</p>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="mt-10 bg-surface/40 border border-dashed border-border-s rounded-2xl p-12 text-center">
          <div className="text-4xl mb-4" aria-hidden>
            🗂
          </div>
          <h3 className="text-lg font-semibold">
            {interviews.length === 0
              ? "No interviews yet"
              : "No interviews match these filters"}
          </h3>
          {interviews.length === 0 && (
            <Link
              href="/upload"
              className="inline-block mt-6 bg-accent hover:bg-accent-hover px-7 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-accent/10 hover:shadow-accent/20"
            >
              Start your first interview →
            </Link>
          )}
        </div>
      )}

      {!loading && visible.length > 0 && (
        <ul className="mt-8 space-y-3">
          {visible.map((interview) => (
            <li
              key={interview.id}
              className="bg-surface/60 border border-border-s hover:border-border-d rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-all duration-200"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate text-primary-text">
                  {interview.role}
                  {interview.company ? ` · ${interview.company}` : ""}
                </p>
                <p className="text-muted-text text-sm mt-1">
                  {formatDate(interview.created_at)} ·{" "}
                  {interview.answered_questions}/{interview.total_questions}{" "}
                  answered · {interview.experience}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {interview.status === "completed" &&
                interview.score !== null ? (
                  <span className="text-xs font-semibold bg-accent/10 text-accent border border-accent/20 rounded-lg px-3 py-1.5">
                    {interview.score.toFixed(1)}/10
                  </span>
                ) : (
                  <span className="text-xs font-semibold bg-warning/10 text-warning border border-warning/20 rounded-lg px-3 py-1.5">
                    In progress
                  </span>
                )}

                {interview.status === "completed" && (
                  <Link
                    href={`/results/${interview.id}`}
                    className="text-accent hover:text-accent-hover text-sm font-semibold transition-colors duration-200"
                  >
                    Results →
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => void handleDelete(interview.id)}
                  disabled={deletingId === interview.id}
                  aria-label={`Delete interview for ${interview.role}`}
                  className="border border-border-s hover:border-danger/40 hover:text-danger hover:bg-danger/5 text-muted-text text-xs font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50 transition-all duration-200"
                >
                  {deletingId === interview.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
