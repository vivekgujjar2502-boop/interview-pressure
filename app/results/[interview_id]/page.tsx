"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  getInterviewResults,
  type InterviewResults,
  type ResultQuestion,
} from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type Phase = "loading" | "not-finished" | "ready" | "error";

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) {
    return "—";
  }

  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);

  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-base border border-border-s rounded-xl px-4 py-3 text-center">
      <p className="text-lg font-bold text-accent">{value}</p>
      <p className="text-muted-text text-xs mt-1">{label}</p>
    </div>
  );
}

function QuestionCard({ question }: { question: ResultQuestion }) {
  const metrics = question.audio_metrics ?? {};
  const hasMetrics =
    metrics.duration_seconds !== undefined &&
    metrics.duration_seconds !== null &&
    metrics.duration_seconds > 0;

  return (
    <div className="bg-surface/60 border border-border-s rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <p className="font-semibold text-sm text-secondary-text">
          Q{question.question_number}. {question.question_text}
        </p>

        {question.score !== null && (
          <span
            className={`shrink-0 text-xs font-semibold border rounded-lg px-2 py-1 ${
              question.score >= 7
                ? "bg-success/10 text-success border-success/20"
                : question.score >= 5
                  ? "bg-accent/10 text-accent border-accent/20"
                  : "bg-danger/10 text-danger border-danger/20"
            }`}
          >
            {question.score}/10
          </span>
        )}
      </div>

      <p className="text-muted-text text-sm mt-3 leading-6 whitespace-pre-wrap">
        {question.answer_text ? question.answer_text : "Not answered."}
      </p>

      {question.feedback && (
        <p className="text-accent/70 text-xs mt-3 italic">
          {question.feedback}
        </p>
      )}

      {(question.strengths.length > 0 ||
        question.weaknesses.length > 0 ||
        question.improvement ||
        question.communication_notes) && (
        <div className="mt-4 space-y-3 border-t border-border-s pt-4">
          {question.strengths.length > 0 && (
            <div>
              <p className="text-muted-text text-xs font-semibold uppercase tracking-wide">
                Strengths
              </p>
              <ul className="mt-1 space-y-1">
                {question.strengths.map((strength) => (
                  <li key={strength} className="text-success text-sm">
                    + {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {question.weaknesses.length > 0 && (
            <div>
              <p className="text-muted-text text-xs font-semibold uppercase tracking-wide">
                Weaknesses
              </p>
              <ul className="mt-1 space-y-1">
                {question.weaknesses.map((weakness) => (
                  <li key={weakness} className="text-secondary-text text-sm">
                    − {weakness}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {question.improvement && (
            <div>
              <p className="text-muted-text text-xs font-semibold uppercase tracking-wide">
                Improvement
              </p>
              <p className="text-secondary-text text-sm mt-1 leading-6">
                {question.improvement}
              </p>
            </div>
          )}

          {question.communication_notes && (
            <div>
              <p className="text-muted-text text-xs font-semibold uppercase tracking-wide">
                Communication
              </p>
              <p className="text-secondary-text text-sm mt-1 leading-6">
                {question.communication_notes}
              </p>
            </div>
          )}
        </div>
      )}

      {hasMetrics && (
        <div className="mt-4 border-t border-border-s pt-4">
          <p className="text-muted-text text-xs font-semibold uppercase tracking-wide mb-2">
            Communication metrics{" "}
            <span className="normal-case font-normal">
              (observable indicators only)
            </span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricTile
              label="Speaking time"
              value={formatDuration(metrics.duration_seconds)}
            />
            <MetricTile
              label="Words / min"
              value={
                metrics.words_per_minute != null
                  ? String(metrics.words_per_minute)
                  : "—"
              }
            />
            <MetricTile
              label="Filler words"
              value={String(metrics.filler_word_count ?? 0)}
            />
            <MetricTile
              label="Pauses"
              value={`${metrics.pause_count ?? 0} (${formatDuration(
                metrics.pause_total_seconds
              )})`}
            />
          </div>
        </div>
      )}

      {question.ai_error && (
        <p className="mt-3 text-xs bg-accent/5 border border-accent/15 rounded-xl px-3 py-2 text-accent">
          Local AI evaluation unavailable — placeholder score used.
        </p>
      )}
    </div>
  );
}

export default function InterviewResultPage() {
  const params = useParams<{ interview_id: string }>();
  const interviewId = Number(params.interview_id);
  const { ready } = useRequireAuth();

  const [phase, setPhase] = useState<Phase>("loading");
  const [results, setResults] = useState<InterviewResults | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const runLoader = useCallback(() => {
    let active = true;

    getInterviewResults(interviewId)
      .then((data) => {
        if (!active) return;
        setResults(data);
        setPhase(data.status === "completed" ? "ready" : "not-finished");
      })
      .catch((error) => {
        if (!active) return;
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load results."
        );
        setPhase("error");
      });

    return () => {
      active = false;
    };
  }, [interviewId]);

  useEffect(() => {
    if (ready) {
      return runLoader();
    }
  }, [ready, runLoader]);

  if (!ready || phase === "loading") {
    return (
      <main className="px-6 py-24 text-center text-muted-text">
        Loading your results...
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="page-enter px-6 py-24 max-w-xl mx-auto text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Could not load results
        </h1>
        <p className="text-secondary-text mt-4">{errorMessage}</p>
        <button
          type="button"
          onClick={runLoader}
          className="mt-8 bg-accent hover:bg-accent-hover px-8 py-4 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-accent/10 hover:shadow-accent/20"
        >
          Try Again
        </button>
      </main>
    );
  }

  if (phase === "not-finished" || !results) {
    return (
      <main className="page-enter px-6 py-24 max-w-xl mx-auto text-center bg-surface border border-border-s rounded-2xl mt-16 shadow-lg shadow-black/20">
        <h1 className="text-2xl font-bold tracking-tight">
          Interview not finished yet
        </h1>
        <p className="text-secondary-text mt-4">
          Results appear once you complete all questions.
        </p>
        <Link
          href="/dashboard"
          className="inline-block mt-8 bg-accent hover:bg-accent-hover px-8 py-4 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-accent/10 hover:shadow-accent/20"
        >
          Back to Dashboard →
        </Link>
      </main>
    );
  }

  const answeredQuestions = results.questions.filter(
    (question) => question.answer_text && question.answer_text.trim()
  );

  const overallStrengths = [
    ...new Set(results.questions.flatMap((q) => q.strengths)),
  ].slice(0, 6);
  const overallWeaknesses = [
    ...new Set(results.questions.flatMap((q) => q.weaknesses)),
  ].slice(0, 6);
  const improvements = results.questions
    .map((q) => q.improvement)
    .filter((item) => item && item.trim());

  return (
    <main className="page-enter px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold text-center tracking-tight">
        Interview Complete
      </h1>

      <div className="mt-10 bg-surface border border-border-s rounded-2xl p-8 shadow-lg shadow-black/20">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-base border border-border-s rounded-xl py-6 px-2">
            <p className="text-3xl font-bold text-accent">
              {(results.overall_score ?? 0).toFixed(1)}
              <span className="text-lg text-muted-text">/10</span>
            </p>
            <p className="text-muted-text text-sm mt-2">Overall score</p>
          </div>

          <div className="bg-base border border-border-s rounded-xl py-6 px-2">
            <p className="text-3xl font-bold text-accent">
              {results.total_questions}
            </p>
            <p className="text-muted-text text-sm mt-2">Questions</p>
          </div>

          <div className="bg-base border border-border-s rounded-xl py-6 px-2">
            <p className="text-3xl font-bold text-accent">
              {answeredQuestions.length}
            </p>
            <p className="text-muted-text text-sm mt-2">Answered</p>
          </div>
        </div>

        {overallStrengths.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-text">
              Overall strengths
            </h2>
            <ul className="mt-2 space-y-1">
              {overallStrengths.map((strength) => (
                <li key={strength} className="text-success text-sm">
                  + {strength}
                </li>
              ))}
            </ul>
          </div>
        )}

        {overallWeaknesses.length > 0 && (
          <div className="mt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-text">
              Overall weaknesses
            </h2>
            <ul className="mt-2 space-y-1">
              {overallWeaknesses.map((weakness) => (
                <li key={weakness} className="text-secondary-text text-sm">
                  − {weakness}
                </li>
              ))}
            </ul>
          </div>
        )}

        {improvements.length > 0 && (
          <div className="mt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-text">
              Recommended improvements
            </h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              {improvements.map((improvement) => (
                <li
                  key={improvement}
                  className="text-secondary-text text-sm leading-6"
                >
                  {improvement}
                </li>
              ))}
            </ul>
          </div>
        )}

        <h2 className="text-xl font-bold mt-10 mb-4 tracking-tight">
          Question breakdown
        </h2>
        <div className="space-y-4">
          {results.questions.map((question) => (
            <QuestionCard key={question.question_number} question={question} />
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-10">
          <Link
            href="/history"
            className="border border-border-d hover:bg-white/5 px-8 py-4 rounded-xl font-semibold transition-all duration-200 text-center text-secondary-text hover:text-primary-text"
          >
            View History
          </Link>

          <Link
            href="/upload"
            className="bg-accent hover:bg-accent-hover px-8 py-4 rounded-xl font-semibold transition-all duration-200 text-center shadow-lg shadow-accent/10 hover:shadow-accent/20"
          >
            New Interview →
          </Link>
        </div>
      </div>
    </main>
  );
}
