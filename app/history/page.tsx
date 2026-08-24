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
      <main className="px-6 py-24 text-center text-gray-500">
        Loading your history...
      </main>
    );
  }

  return (
    <main className="px-6 py-12 max-w-5xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold">Interview history</h1>
      <p className="text-gray-400 mt-3">
        Every mock interview you have completed, with scores and feedback.
      </p>

      <div className="mt-8 bg-gray-950 border border-gray-800 rounded-2xl p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="filter-role" className="text-xs text-gray-500 block mb-2">
            Role contains
          </label>
          <input
            id="filter-role"
            type="text"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            placeholder="e.g. Backend"
            className="w-full bg-black border border-gray-700 rounded-xl px-3 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div>
          <label
            htmlFor="filter-company"
            className="text-xs text-gray-500 block mb-2"
          >
            Company contains
          </label>
          <input
            id="filter-company"
            type="text"
            value={companyFilter}
            onChange={(event) => setCompanyFilter(event.target.value)}
            placeholder="e.g. Google"
            className="w-full bg-black border border-gray-700 rounded-xl px-3 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div>
          <label
            htmlFor="filter-score"
            className="text-xs text-gray-500 block mb-2"
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
            className="w-full bg-black border border-gray-700 rounded-xl px-3 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div>
          <label htmlFor="sort-order" className="text-xs text-gray-500 block mb-2">
            Sort by
          </label>
          <select
            id="sort-order"
            value={sortOrder}
            onChange={(event) =>
              setSortOrder(event.target.value as typeof sortOrder)
            }
            className="w-full bg-black border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="score">Highest score</option>
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-6 text-sm text-red-400">
          {error}
        </p>
      )}

      {loading && (
        <p className="mt-10 text-gray-500">Loading interviews...</p>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="mt-10 bg-gray-950 border border-dashed border-gray-700 rounded-2xl p-12 text-center">
          <h3 className="text-lg font-semibold">
            {interviews.length === 0
              ? "No interviews yet"
              : "No interviews match these filters"}
          </h3>
          {interviews.length === 0 && (
            <Link
              href="/upload"
              className="inline-block mt-6 bg-blue-600 hover:bg-blue-700 px-7 py-3 rounded-xl font-semibold transition"
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
              className="bg-gray-950 border border-gray-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {interview.role}
                  {interview.company ? ` · ${interview.company}` : ""}
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  {formatDate(interview.created_at)} ·{" "}
                  {interview.answered_questions}/{interview.total_questions}{" "}
                  answered · {interview.experience}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {interview.status === "completed" &&
                interview.score !== null ? (
                  <span className="text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg px-3 py-1.5">
                    {interview.score.toFixed(1)}/10
                  </span>
                ) : (
                  <span className="text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-lg px-3 py-1.5">
                    In progress
                  </span>
                )}

                {interview.status === "completed" && (
                  <Link
                    href={`/results/${interview.id}`}
                    className="text-blue-400 hover:text-blue-300 text-sm font-semibold transition"
                  >
                    Results →
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => void handleDelete(interview.id)}
                  disabled={deletingId === interview.id}
                  aria-label={`Delete interview for ${interview.role}`}
                  className="border border-gray-800 hover:border-red-500/50 hover:text-red-400 text-gray-500 text-xs font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50 transition"
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
