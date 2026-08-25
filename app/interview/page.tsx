"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createInterview,
  evaluateAnswer,
  finishInterview,
  getInterview,
  transcribeAnswerAudio,
  type Interview,
} from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

const RESUME_ID_STORAGE_KEY = "interview-pressure-resume-id";
const JOB_ID_STORAGE_KEY = "interview-pressure-job-id";
const INTERVIEW_ID_STORAGE_KEY = "interview-pressure-interview-id";

type Phase = "loading" | "missing" | "session" | "error";

type LoadOutcome =
  | { kind: "missing" }
  | { kind: "session"; interview: Interview }
  | { kind: "completed" }
  | { kind: "error"; message: string };

type VoiceStage =
  | "idle"
  | "recording"
  | "recorded"
  | "uploading"
  | "transcribing"
  | "analyzing"
  | "analyzed"
  | "error";

async function fetchSessionState(): Promise<LoadOutcome> {
  const resumeId = Number(sessionStorage.getItem(RESUME_ID_STORAGE_KEY));
  const jobId = Number(sessionStorage.getItem(JOB_ID_STORAGE_KEY));

  if (!resumeId || !jobId) {
    return { kind: "missing" };
  }

  const storedInterviewId = Number(
    sessionStorage.getItem(INTERVIEW_ID_STORAGE_KEY)
  );

  if (storedInterviewId) {
    try {
      const existing = await getInterview(storedInterviewId);

      if (existing.status === "completed") {
        return { kind: "completed" };
      }

      return { kind: "session", interview: existing };
    } catch {
      sessionStorage.removeItem(INTERVIEW_ID_STORAGE_KEY);
    }
  }

  try {
    const created = await createInterview({
      resume_id: resumeId,
      job_id: jobId,
    });

    sessionStorage.setItem(INTERVIEW_ID_STORAGE_KEY, String(created.id));

    return { kind: "session", interview: created };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not start the interview.",
    };
  }
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

  for (const candidate of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(candidate)
    ) {
      return candidate;
    }
  }

  return "";
}

function microphoneErrorMessage(error: unknown): string {
  if (!(error instanceof DOMException)) {
    return "Could not start the recording. Please try again or type your answer instead.";
  }

  switch (error.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone permission was denied. Allow microphone access in your browser settings and try again, or type your answer instead.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No microphone was found. Connect a microphone or type your answer instead.";
    case "NotReadableError":
      return "Your microphone is busy or unavailable. Close other apps using it, then try again.";
    default:
      return `Could not start the recording: ${error.message}. You can type your answer instead.`;
  }
}

interface InterviewSessionProps {
  interview: Interview;
  onFinish: () => void;
}

function InterviewSession({ interview, onFinish }: InterviewSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    const initialAnswers: Record<number, string> = {};

    for (const question of interview.questions) {
      if (question.answer_text && question.answer_text.trim()) {
        initialAnswers[question.id] = question.answer_text;
      }
    }

    return initialAnswers;
  });
  const [savedQuestionIds, setSavedQuestionIds] = useState<number[]>(() =>
    interview.questions
      .filter(
        (question) => question.answer_text && question.answer_text.trim()
      )
      .map((question) => question.id)
  );
  const [scoresMap, setScoresMap] = useState<Record<number, number | null>>({});
  const [aiNotices, setAiNotices] = useState<Record<number, string>>({});

  const [validationError, setValidationError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);

  const [voiceStage, setVoiceStage] = useState<VoiceStage>("idle");
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioUrlRef = useRef<string | null>(null);
  const [recordedUrl, setRecordedUrl] = useState("");

  const totalQuestions = interview.questions.length;
  const currentQuestion = interview.questions[currentIndex];

  const isCurrentSaved = savedQuestionIds.includes(currentQuestion.id);
  const answeredCount = savedQuestionIds.length;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const progressPercent = ((currentIndex + 1) / totalQuestions) * 100;

  const isBusy =
    voiceStage === "recording" ||
    voiceStage === "uploading" ||
    voiceStage === "transcribing" ||
    voiceStage === "analyzing" ||
    isFinishing;

  const markQuestionSaved = useCallback(
    (questionId: number, score: number | null, aiError: string) => {
      setSavedQuestionIds((previous) =>
        previous.includes(questionId) ? previous : [...previous, questionId]
      );
      setScoresMap((previous) => ({
        ...previous,
        [questionId]: score,
      }));
      setAiNotices((previous) => ({ ...previous, [questionId]: aiError }));
    },
    []
  );

  const releaseMicrophone = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (voiceStage !== "recording") {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRecordedSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [voiceStage]);

  const handleAnswerChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const { value } = event.target;

    setAnswers((previous) => ({
      ...previous,
      [currentQuestion.id]: value,
    }));

    if (validationError) {
      setValidationError("");
    }

    if (voiceStage === "analyzed") {
      setVoiceStage("idle");
    }
  };

  const startRecording = async () => {
    setVoiceError("");
    setValidationError("");

    if (
      typeof navigator.mediaDevices === "undefined" ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setVoiceError(
        "Your browser does not support audio recording. Please type your answer instead."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blobMimeType =
          mediaRecorderRef.current?.mimeType || "audio/webm";
        mediaRecorderRef.current = null;
        releaseMicrophone();

        const blob = new Blob(chunksRef.current, { type: blobMimeType });
        chunksRef.current = [];

        if (blob.size === 0) {
          setVoiceStage("idle");
          setVoiceError(
            "The recording was empty. Please try again or type your answer."
          );
          return;
        }

        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
        }

        audioUrlRef.current = URL.createObjectURL(blob);
        setRecordedUrl(audioUrlRef.current);
        setVoiceStage("recorded");
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordedSeconds(0);
      setVoiceStage("recording");
    } catch (error) {
      releaseMicrophone();
      setVoiceStage("idle");
      setVoiceError(microphoneErrorMessage(error));
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const discardRecording = () => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
      setRecordedUrl("");
    }

    setVoiceStage("idle");
    setVoiceError("");
  };

  const submitRecording = async () => {
    if (!audioUrlRef.current) {
      return;
    }

    setActionError("");
    setVoiceError("");

    try {
      setVoiceStage("uploading");

      const blobResponse = await fetch(recordedUrl);
      const blob = await blobResponse.blob();
      const mimeType = blob.type || "audio/webm";
      const extension = mimeType.includes("mp4")
        ? "m4a"
        : mimeType.includes("wav")
          ? "wav"
          : "webm";
      const file = new File([blob], `answer.${extension}`, { type: mimeType });

      setVoiceStage("transcribing");

      const transcriptResult = await transcribeAnswerAudio(
        interview.id,
        currentQuestion.id,
        file
      );

      setAnswers((previous) => ({
        ...previous,
        [currentQuestion.id]: transcriptResult.transcript,
      }));

      setVoiceStage("analyzing");

      const result = await evaluateAnswer(
        interview.id,
        currentQuestion.id,
        transcriptResult.transcript
      );

      setAnswers((previous) => ({
        ...previous,
        [currentQuestion.id]: result.answer_text,
      }));
      markQuestionSaved(currentQuestion.id, result.score, result.ai_error);
      setVoiceStage("analyzed");
    } catch (error) {
      setVoiceStage("recorded");
      setVoiceError(
        error instanceof Error
          ? error.message
          : "Could not process your recording. Your audio is kept — try submitting again."
      );
    }
  };

  const retryEvaluation = async () => {
    const answerText = (answers[currentQuestion.id] ?? "").trim();

    if (!answerText) {
      setValidationError("Please type or record your answer first.");
      return;
    }

    setActionError("");
    setVoiceError("");
    setVoiceStage("analyzing");

    try {
      const result = await evaluateAnswer(
        interview.id,
        currentQuestion.id,
        answerText
      );

      markQuestionSaved(currentQuestion.id, result.score, result.ai_error);
      setVoiceStage("analyzed");
    } catch (error) {
      setVoiceStage("idle");
      setActionError(
        error instanceof Error ? error.message : "Evaluation failed."
      );
    }
  };

  const submitTypedAnswer = async (): Promise<boolean> => {
    const answerText = (answers[currentQuestion.id] ?? "").trim();

    if (!answerText) {
      setValidationError("Please type or record your answer before continuing.");
      return false;
    }

    setVoiceStage("analyzing");

    try {
      const result = await evaluateAnswer(
        interview.id,
        currentQuestion.id,
        answerText
      );

      markQuestionSaved(currentQuestion.id, result.score, result.ai_error);
      setVoiceStage("analyzed");
      return true;
    } catch (error) {
      setVoiceStage("idle");
      setActionError(
        error instanceof Error ? error.message : "Could not save your answer."
      );
      return false;
    }
  };

  const handleSubmitAnswer = async () => {
    setActionError("");
    setValidationError("");

    if (voiceStage === "recorded") {
      await submitRecording();
      return;
    }

    await submitTypedAnswer();
  };

  const goToNextOrFinishGuard = (): boolean => {
    if (!savedQuestionIds.includes(currentQuestion.id)) {
      setValidationError(
        "Submit your answer before moving to the next question."
      );
      return false;
    }

    return true;
  };

  const handlePrevious = () => {
    if (currentIndex > 0 && !isBusy) {
      setValidationError("");
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (isBusy) return;

    if (!goToNextOrFinishGuard()) {
      return;
    }

    setCurrentIndex(currentIndex + 1);
  };

  const handleFinish = async () => {
    if (isBusy) return;

    if (!goToNextOrFinishGuard()) {
      return;
    }

    setIsFinishing(true);
    setActionError("");

    try {
      await finishInterview(interview.id);
      onFinish();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not finish the interview."
      );
      setIsFinishing(false);
    }
  };

  const processingLabel =
    voiceStage === "uploading"
      ? "Uploading your recording..."
      : voiceStage === "transcribing"
        ? "Transcribing locally..."
        : voiceStage === "analyzing"
          ? "Analyzing your answer..."
          : "";

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl md:text-3xl font-bold text-center tracking-tight">
        Mock Interview
      </h1>

      <p className="text-secondary-text text-center mt-3 text-sm">
        {interview.job_role} · {interview.experience}
        {interview.company ? ` · ${interview.company}` : ""}
      </p>

      <div className="mt-10 bg-surface border border-border-s rounded-2xl p-6 sm:p-8 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between mb-3 gap-4">
          <p className="text-sm font-semibold text-accent">
            Question {currentIndex + 1} of {totalQuestions}
            {isCurrentSaved && (
              <span className="text-success ml-2">✓ Saved</span>
            )}
            {isCurrentSaved && scoresMap[currentQuestion.id] != null && (
              <span className="ml-2 text-xs font-semibold bg-accent/10 text-accent border border-accent/20 rounded-lg px-2 py-1">
                {scoresMap[currentQuestion.id]}/10
              </span>
            )}
          </p>
          <p className="text-muted-text text-sm shrink-0">
            {answeredCount}/{totalQuestions} saved
          </p>
        </div>

        <div className="h-1.5 w-full bg-border-s rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-secondary rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p className="text-lg md:text-xl leading-relaxed mt-8 text-primary-text">
          {currentQuestion.question_text}
        </p>

        <textarea
          value={answers[currentQuestion.id] ?? ""}
          onChange={handleAnswerChange}
          placeholder="Type your answer here, or record it with the button below..."
          rows={5}
          aria-label={`Your answer to question ${currentIndex + 1}`}
          readOnly={voiceStage === "recording"}
          className="w-full bg-base border border-border-s focus:border-accent focus:ring-1 focus:ring-accent/30 rounded-xl px-4 py-3 text-primary-text placeholder-muted-text focus:outline-none transition-all duration-200 mt-8 resize-y disabled:opacity-60"
        />

        {/* Voice controls */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          {voiceStage === "idle" && (
            <button
              type="button"
              onClick={() => void startRecording()}
              className="border border-border-d hover:bg-white/5 px-6 py-3 rounded-xl font-semibold text-sm text-secondary-text hover:text-primary-text transition-all duration-200 inline-flex items-center justify-center gap-2"
            >
              <span className="w-3 h-3 rounded-full bg-danger pulse-recording" aria-hidden />
              Start Recording
            </button>
          )}

          {voiceStage === "recording" && (
            <>
              <span
                role="status"
                className="flex items-center gap-2 text-sm font-semibold text-danger"
              >
                <span
                  className="w-3 h-3 rounded-full bg-danger pulse-recording"
                  aria-hidden
                />
                Recording… {formatTime(recordedSeconds)}
              </span>
              <button
                type="button"
                onClick={stopRecording}
                className="bg-danger hover:bg-danger/80 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200"
              >
                Stop Recording
              </button>
            </>
          )}

          {voiceStage === "recorded" && (
            <>
              <audio
                controls
                src={recordedUrl}
                aria-label="Playback of your recording"
                className="h-11 max-w-full"
              />
              <button
                type="button"
                onClick={discardRecording}
                className="border border-border-d hover:bg-white/5 px-5 py-3 rounded-xl font-semibold text-sm text-secondary-text hover:text-primary-text transition-all duration-200"
              >
                Re-record
              </button>
            </>
          )}

          {(processingLabel || voiceStage === "analyzed") && (
            <p
              role="status"
              className={`text-sm ${
                voiceStage === "analyzed" ? "text-success" : "text-accent"
              }`}
            >
              {voiceStage === "analyzed"
                ? "✓ Answer analyzed"
                : processingLabel}
            </p>
          )}

          <p className="text-xs text-muted-text sm:ml-auto">
            Type above or use your voice — both are evaluated.
          </p>
        </div>

        {(voiceError || actionError) && (
          <div
            role="alert"
            className="mt-3 bg-danger/5 border border-danger/20 text-danger text-sm rounded-xl px-4 py-3"
          >
            {voiceError || actionError}
          </div>
        )}

        {aiNotices[currentQuestion.id] && (
          <div className="mt-3 text-xs bg-accent/5 border border-accent/15 rounded-xl px-4 py-3 text-accent break-words">
            Local AI unavailable for this answer — a placeholder score was
            used. Setup info: {aiNotices[currentQuestion.id]}
          </div>
        )}

        {validationError && (
          <div
            role="alert"
            className="mt-3 bg-warning/5 border border-warning/20 text-warning text-sm rounded-xl px-4 py-3"
          >
            {validationError}
          </div>
        )}

        {/* Primary actions */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentIndex === 0 || isBusy}
            className="border border-border-d hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed px-8 py-3.5 rounded-xl font-semibold text-sm text-secondary-text hover:text-primary-text transition-all duration-200 flex-1"
          >
            ← Previous
          </button>

          {!isCurrentSaved && (
            <button
              type="button"
              onClick={() => void handleSubmitAnswer()}
              disabled={isBusy}
              className="bg-accent hover:bg-accent-hover disabled:opacity-50 px-8 py-3.5 rounded-xl font-semibold transition-all duration-200 flex-1 shadow-lg shadow-accent/10 hover:shadow-accent/20"
            >
              {voiceStage === "analyzing"
                ? "Analyzing..."
                : voiceStage === "transcribing"
                  ? "Transcribing..."
                  : voiceStage === "uploading"
                    ? "Uploading..."
                    : "Submit Answer ✓"}
            </button>
          )}

          {isLastQuestion ? (
            <button
              type="button"
              onClick={() => void handleFinish()}
              disabled={!isCurrentSaved || isBusy}
              className="bg-accent hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed px-8 py-3.5 rounded-xl font-semibold transition-all duration-200 flex-1 shadow-lg shadow-accent/10 hover:shadow-accent/20"
            >
              {isFinishing ? "Finishing..." : "Finish Interview ✓"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={!isCurrentSaved || isBusy}
              className="bg-accent hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed px-8 py-3.5 rounded-xl font-semibold transition-all duration-200 flex-1 shadow-lg shadow-accent/10 hover:shadow-accent/20"
            >
              Next Question →
            </button>
          )}
        </div>

        {isCurrentSaved && !isLastQuestion && (
          <button
            type="button"
            onClick={() => void retryEvaluation()}
            disabled={isBusy}
            className="mt-4 text-xs text-muted-text hover:text-accent underline transition-colors duration-200 disabled:opacity-50"
          >
            Re-evaluate this answer
          </button>
        )}
      </div>

      <p className="text-center mt-8">
        <Link
          href="/dashboard"
          className="text-muted-text hover:text-secondary-text text-sm transition-colors duration-200"
        >
          ← Back to Dashboard
        </Link>
      </p>
    </div>
  );
}

export default function InterviewPage() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const [phase, setPhase] = useState<Phase>("loading");
  const [interview, setInterview] = useState<Interview | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const applyOutcome = useCallback(
    (outcome: LoadOutcome) => {
      switch (outcome.kind) {
        case "missing":
          setPhase("missing");
          break;
        case "session":
          setInterview(outcome.interview);
          setPhase("session");
          break;
        case "completed":
          router.replace("/dashboard");
          break;
        case "error":
          setErrorMessage(outcome.message);
          setPhase("error");
          break;
      }
    },
    [router]
  );

  const runLoader = useCallback(() => {
    fetchSessionState().then(applyOutcome);
  }, [applyOutcome]);

  useEffect(() => {
    if (ready) {
      runLoader();
    }
  }, [ready, runLoader]);

  const handleFinish = () => {
    if (interview) {
      router.push(`/results/${interview.id}`);
    } else {
      router.push("/dashboard");
    }
  };

  const handleRetry = () => {
    setPhase("loading");
    runLoader();
  };

  if (!ready) {
    return (
      <main className="px-6 py-24 text-center text-muted-text">Loading...</main>
    );
  }

  return (
    <main className="page-enter">
      {phase === "loading" && (
        <div className="max-w-3xl mx-auto text-center mt-24">
          <p className="text-accent">Preparing your interview...</p>
        </div>
      )}

      {phase === "missing" && (
        <div className="max-w-xl mx-auto text-center mt-20 bg-surface border border-border-s rounded-2xl p-10 mx-6 shadow-lg shadow-black/20">
          <h1 className="text-2xl font-bold tracking-tight">
            No interview session found
          </h1>
          <p className="text-secondary-text mt-4">
            Pick a resume and enter the job you are targeting to begin.
          </p>
          <Link
            href="/upload"
            className="inline-block bg-accent hover:bg-accent-hover px-8 py-4 rounded-xl font-semibold transition-all duration-200 mt-8 shadow-lg shadow-accent/10 hover:shadow-accent/20"
          >
            Start from Resume →
          </Link>
        </div>
      )}

      {phase === "error" && (
        <div className="max-w-xl mx-auto text-center mt-20 bg-surface border border-border-s rounded-2xl p-10 mx-6 shadow-lg shadow-black/20">
          <h1 className="text-2xl font-bold tracking-tight">
            Something went wrong
          </h1>
          <p className="text-secondary-text mt-4">{errorMessage}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-block bg-accent hover:bg-accent-hover px-8 py-4 rounded-xl font-semibold transition-all duration-200 mt-8 shadow-lg shadow-accent/10 hover:shadow-accent/20"
          >
            Try Again
          </button>
        </div>
      )}

      {phase === "session" && interview && (
        <InterviewSession interview={interview} onFinish={handleFinish} />
      )}
    </main>
  );
}
