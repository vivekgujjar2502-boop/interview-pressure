"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  getDashboardStats,
  listInterviews,
  type DashboardStats,
  type InterviewSummary,
} from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type LoadOutcome =
  | { kind: "ready"; stats: DashboardStats; recent: InterviewSummary[] }
  | { kind: "error"; message: string };

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DashboardPage() {
  const { ready, user } = useRequireAuth();
  const [outcome, setOutcome] = useState<LoadOutcome | null>(null);

  const runLoader = useCallback(() => {
    Promise.all([getDashboardStats(), listInterviews()])
      .then(([stats, interviews]) => {
        setOutcome({
          kind: "ready",
          stats,
          recent: interviews.slice(0, 5),
        });
      })
      .catch((error) => {
        setOutcome({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not load your dashboard.",
        });
      });
  }, []);

  useEffect(() => {
    if (ready) {
      runLoader();
    }
  }, [ready, runLoader]);

  if (!ready) {
    return (
      <main className="px-6 py-24 text-center text-muted-text">
        Loading your workspace...
      </main>
    );
  }

  const stats = outcome?.kind === "ready" ? outcome.stats : null;
  const recent = outcome?.kind === "ready" ? outcome.recent : [];

  return (
    <main className="page-enter px-6 py-12 max-w-6xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        Welcome{user ? `, ${user.name.split(" ")[0]}` : ""}
      </h1>
      <p className="text-secondary-text mt-2">
        Ready for today&apos;s practice session?
      </p>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-4 mt-10">
        <Link
          href="/upload"
          className="group bg-accent hover:bg-accent-hover rounded-2xl p-6 transition-all duration-200 font-semibold shadow-lg shadow-accent/10 hover:shadow-accent/20"
        >
          <span className="block text-2xl mb-2" aria-hidden>
            🎙
          </span>
          <span className="flex items-center gap-1">
            New Interview
            <span className="inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </span>
        </Link>

        <Link
          href="/upload"
          className="border border-border-s bg-surface/60 hover:bg-surface hover:border-border-d rounded-2xl p-6 transition-all duration-200 font-semibold"
        >
          <span className="block text-2xl mb-2" aria-hidden>
            📄
          </span>
          Upload Resume
        </Link>

        <Link
          href="/history"
          className="border border-border-s bg-surface/60 hover:bg-surface hover:border-border-d rounded-2xl p-6 transition-all duration-200 font-semibold"
        >
          <span className="block text-2xl mb-2" aria-hidden>
            🗂
          </span>
          View History
        </Link>
      </div>

      {outcome === null && (
        <p className="mt-14 text-muted-text text-sm">
          Loading your statistics...
        </p>
      )}

      {outcome?.kind === "error" && (
        <div className="mt-14 bg-surface border border-danger/20 rounded-2xl p-8 text-center">
          <p className="text-danger">{outcome.message}</p>
          <button
            type="button"
            onClick={runLoader}
            className="mt-5 border border-border-d hover:bg-white/5 px-6 py-3 rounded-xl font-semibold text-sm text-secondary-text hover:text-primary-text transition-all duration-200"
          >
            Try Again
          </button>
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
            <div className="bg-surface/60 border border-border-s rounded-2xl p-6 text-center">
              <p className="text-3xl font-bold text-accent">
                {stats.interviews_completed}
              </p>
              <p className="text-muted-text text-sm mt-2">Completed</p>
            </div>
            <div className="bg-surface/60 border border-border-s rounded-2xl p-6 text-center">
              <p className="text-3xl font-bold text-accent">
                {stats.average_score !== null
                  ? stats.average_score.toFixed(1)
                  : "—"}
              </p>
              <p className="text-muted-text text-sm mt-2">Average score</p>
            </div>
            <div className="bg-surface/60 border border-border-s rounded-2xl p-6 text-center">
              <p className="text-3xl font-bold text-accent">
                {stats.best_score !== null ? stats.best_score.toFixed(1) : "—"}
              </p>
              <p className="text-muted-text text-sm mt-2">Best score</p>
            </div>
            <div className="bg-surface/60 border border-border-s rounded-2xl p-6 text-center">
              <p className="text-3xl font-bold text-accent">
                {stats.questions_answered}
              </p>
              <p className="text-muted-text text-sm mt-2">Answers given</p>
            </div>
          </div>

          <h2 className="text-xl font-bold mt-16 tracking-tight">
            Recent interviews
          </h2>

          {recent.length === 0 ? (
            <div className="mt-6 bg-surface/40 border border-dashed border-border-s rounded-2xl p-12 text-center">
              <div className="text-4xl mb-4" aria-hidden>
                🚀
              </div>
              <h3 className="text-lg font-semibold">No interviews yet</h3>
              <p className="text-secondary-text text-sm mt-2 max-w-md mx-auto">
                Run your first mock interview to see scores, feedback and
                progress tracking here.
              </p>
              <Link
                href="/upload"
                className="inline-block mt-6 bg-accent hover:bg-accent-hover px-7 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-accent/10 hover:shadow-accent/20"
              >
                Start your first interview →
              </Link>
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {recent.map((interview) => (
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
                      {interview.answered_questions}/
                      {interview.total_questions} answered
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
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
                    <Link
                      href={
                        interview.status === "completed"
                          ? `/results/${interview.id}`
                          : "/history"
                      }
                      className="text-accent hover:text-accent-hover text-sm font-semibold transition-colors duration-200"
                    >
                      View →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
