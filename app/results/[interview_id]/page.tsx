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
    <div className="bg-black border border-gray-800 rounded-xl px-4 py-3 text-center">
      <p className="text-lg font-bold text-blue-400">{value}</p>
      <p className="text-gray-500 text-xs mt-1">{label}</p>
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
    <div className="bg-black border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <p className="font-semibold text-sm text-gray-300">
          Q{question.question_number}. {question.question_text}
        </p>

        {question.score !== null && (
          <span
            className={`shrink-0 text-xs font-semibold border rounded-lg px-2 py-1 ${
              question.score >= 7
                ? "bg-green-500/10 text-green-400 border-green-500/30"
                : question.score >= 5
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                  : "bg-red-500/10 text-red-400 border-red-500/30"
            }`}
          >
            {question.score}/10
          </span>
        )}
      </div>

      <p className="text-gray-500 text-sm mt-3 leading-6 whitespace-pre-wrap">
        {question.answer_text ? question.answer_text : "Not answered."}
      </p>

      {question.feedback && (
        <p className="text-blue-300/70 text-xs mt-3 italic">
          {question.feedback}
        </p>
      )}

      {(question.strengths.length > 0 ||
        question.weaknesses.length > 0 ||
        question.improvement ||
        question.communication_notes) && (
        <div className="mt-4 space-y-3 border-t border-gray-900 pt-4">
          {question.strengths.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">
                Strengths
              </p>
              <ul className="mt-1 space-y-1">
                {question.strengths.map((strength) => (
                  <li key={strength} className="text-blue-300 text-sm">
                    + {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {question.weaknesses.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">
                Weaknesses
              </p>
              <ul className="mt-1 space-y-1">
                {question.weaknesses.map((weakness) => (
                  <li key={weakness} className="text-gray-400 text-sm">
                    − {weakness}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {question.improvement && (
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">
                Improvement
              </p>
              <p className="text-gray-300 text-sm mt-1 leading-6">
                {question.improvement}
              </p>
            </div>
          )}

          {question.communication_notes && (
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">
                Communication
              </p>
              <p className="text-gray-300 text-sm mt-1 leading-6">
                {question.communication_notes}
              </p>
            </div>
          )}
        </div>
      )}

      {hasMetrics && (
        <div className="mt-4 border-t border-gray-900 pt-4">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">
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
        <p className="mt-3 text-xs bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 text-blue-300">
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
      <main className="px-6 py-24 text-center text-gray-500">
        Loading your results...
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="px-6 py-24 max-w-xl mx-auto text-center">
        <h1 className="text-2xl font-bold">Could not load results</h1>
        <p className="text-gray-400 mt-4">{errorMessage}</p>
        <button
          type="button"
          onClick={runLoader}
          className="mt-8 bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-xl font-semibold transition"
        >
          Try Again
        </button>
      </main>
    );
  }

  if (phase === "not-finished" || !results) {
    return (
      <main className="px-6 py-24 max-w-xl mx-auto text-center bg-gray-950 border border-gray-800 rounded-2xl mt-16">
        <h1 className="text-2xl font-bold">Interview not finished yet</h1>
        <p className="text-gray-400 mt-4">
          Results appear once you complete all questions.
        </p>
        <Link
          href="/dashboard"
          className="inline-block mt-8 bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-xl font-semibold transition"
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
    <main className="px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold text-center">
        Interview Complete
      </h1>

      <div className="mt-10 bg-gray-950 border border-gray-800 rounded-2xl p-8">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-black border border-gray-800 rounded-xl py-6 px-2">
            <p className="text-3xl font-bold text-blue-500">
              {(results.overall_score ?? 0).toFixed(1)}
              <span className="text-lg text-gray-500">/10</span>
            </p>
            <p className="text-gray-500 text-sm mt-2">Overall score</p>
          </div>

          <div className="bg-black border border-gray-800 rounded-xl py-6 px-2">
            <p className="text-3xl font-bold text-blue-500">
              {results.total_questions}
            </p>
            <p className="text-gray-500 text-sm mt-2">Questions</p>
          </div>

          <div className="bg-black border border-gray-800 rounded-xl py-6 px-2">
            <p className="text-3xl font-bold text-blue-500">
              {answeredQuestions.length}
            </p>
            <p className="text-gray-500 text-sm mt-2">Answered</p>
          </div>
        </div>

        {overallStrengths.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Overall strengths
            </h2>
            <ul className="mt-2 space-y-1">
              {overallStrengths.map((strength) => (
                <li key={strength} className="text-blue-300 text-sm">
                  + {strength}
                </li>
              ))}
            </ul>
          </div>
        )}

        {overallWeaknesses.length > 0 && (
          <div className="mt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Overall weaknesses
            </h2>
            <ul className="mt-2 space-y-1">
              {overallWeaknesses.map((weakness) => (
                <li key={weakness} className="text-gray-400 text-sm">
                  − {weakness}
                </li>
              ))}
            </ul>
          </div>
        )}

        {improvements.length > 0 && (
          <div className="mt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Recommended improvements
            </h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              {improvements.map((improvement) => (
                <li key={improvement} className="text-gray-300 text-sm leading-6">
                  {improvement}
                </li>
              ))}
            </ul>
          </div>
        )}

        <h2 className="text-xl font-bold mt-10 mb-4">Question breakdown</h2>
        <div className="space-y-4">
          {results.questions.map((question) => (
            <QuestionCard key={question.question_number} question={question} />
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-10">
          <Link
            href="/history"
            className="border border-gray-700 hover:bg-gray-900 px-8 py-4 rounded-xl font-semibold transition text-center"
          >
            View History
          </Link>

          <Link
            href="/upload"
            className="bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-xl font-semibold transition text-center"
          >
            New Interview →
          </Link>
        </div>
      </div>
    </main>
  );
}
