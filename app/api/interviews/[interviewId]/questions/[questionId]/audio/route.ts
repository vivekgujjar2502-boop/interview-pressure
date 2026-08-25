import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import { findSession, getInterviewById, upsertAnswer } from "@/lib/crud";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";

const SESSION_COOKIE = "ip_session";

function analyzeTranscriptMetrics(transcript: string, segments: { start: number; end: number }[]) {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  let durationSeconds = 0;
  let pauseTotal = 0;
  let pauseCount = 0;

  if (segments.length > 0) {
    durationSeconds = Math.max(0, segments[segments.length - 1].end - segments[0].start);
    for (let i = 1; i < segments.length; i++) {
      const gap = segments[i].start - segments[i - 1].end;
      if (gap >= 0.6) {
        pauseTotal += gap;
        pauseCount++;
      }
    }
  }

  const wpm =
    durationSeconds >= 1.0 && wordCount > 0
      ? Math.round((wordCount / (durationSeconds / 60.0)) * 10) / 10
      : null;

  const fillerPatterns = [
    /\bum\b/gi, /\buh\b/gi, /\ber\b/gi, /\bah\b/gi,
    /\blike\b/gi, /\byou know\b/gi, /\bbasically\b/gi,
    /\bactually\b/gi, /\bliterally\b/gi, /\bi mean\b/gi,
  ];
  const fillerCount = fillerPatterns.reduce(
    (count, pattern) => count + (transcript.match(pattern)?.length || 0),
    0
  );

  return {
    duration_seconds: Math.round(durationSeconds * 10) / 10,
    word_count: wordCount,
    words_per_minute: wpm,
    filler_word_count: fillerCount,
    pause_count: pauseCount,
    pause_total_seconds: Math.round(pauseTotal * 10) / 10,
  };
}

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await findSession(token);
  return session?.user ?? null;
}

function jsonError(detail: string, status = 400) {
  return NextResponse.json({ detail }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ interviewId: string; questionId: string }> }
) {
  await initDb();
  const user = await getCurrentUser();
  if (!user) return jsonError("Unauthorized", 401);

  const { interviewId, questionId } = await params;
  const ivId = parseInt(interviewId, 10);
  const qId = parseInt(questionId, 10);

  const interview = await getInterviewById(ivId, user.id);
  if (!interview) return jsonError("Interview not found.", 404);

  const question = interview.questions.find((q) => q.id === qId);
  if (!question) {
    return jsonError("Question does not belong to this interview.", 404);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data.", 422);
  }

  const audioFile = formData.get("audio") as File | null;
  if (!audioFile) return jsonError("No audio file provided.");

  const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
  if (audioFile.size > MAX_AUDIO_BYTES) {
    return jsonError("Audio file is too large (max 25 MB).", 413);
  }

  const ext = audioFile.name.split(".").pop() || "webm";
  const tmpDir = join(process.cwd(), "tmp", `interview_${ivId}`);
  await mkdir(tmpDir, { recursive: true });
  const audioPath = join(tmpDir, `q${qId}_${randomBytes(8).toString("hex")}.${ext}`);

  const arrayBuffer = await audioFile.arrayBuffer();
  await writeFile(audioPath, Buffer.from(arrayBuffer));

  const metrics = analyzeTranscriptMetrics("", []);
  await upsertAnswer(qId, "", null, audioPath);

  return NextResponse.json({
    question_id: qId,
    transcript: "",
    audio_path: audioPath,
    audio_metrics: metrics,
  });
}
