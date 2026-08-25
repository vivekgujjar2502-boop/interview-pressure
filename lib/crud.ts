import { type Row } from "@libsql/client";
import { getDb } from "./db";
import { generateToken, hashToken } from "./security";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowAs<T>(row: Row | undefined): T {
  return row as unknown as T;
}

function rowsAs<T>(rows: Row[]): T[] {
  return rows as unknown as T[];
}

function addDays(date: Date, days: number): string {
  const d = new Date(date.getTime() + days * 86400_000);
  return d.toISOString().replace("T", " ").replace("Z", "");
}

export function decodeStrList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.map(String) : [];
  } catch {
    return [];
  }
}

export function decodeDict(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw);
    return typeof data === "object" && data !== null ? data : {};
  } catch {
    return {};
  }
}

function encodeStrList(items: string[]): string {
  return JSON.stringify(items);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface DbUser {
  id: number;
  name: string;
  email: string;
  password_hash: string | null;
  created_at: string;
  updated_at: string;
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM users WHERE LOWER(email) = LOWER(TRIM(?))",
    args: [email],
  });
  return rowAs<DbUser>(result.rows[0]) ?? null;
}

export async function getUserById(id: number): Promise<DbUser | null> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [id],
  });
  return rowAs<DbUser>(result.rows[0]) ?? null;
}

export async function createUser(
  name: string,
  email: string,
  passwordHash: string
): Promise<DbUser> {
  const db = getDb();
  const result = await db.execute({
    sql: "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
    args: [name.trim(), email.trim().toLowerCase(), passwordHash],
  });
  return (await getUserById(Number(result.lastInsertRowid)))!;
}

export async function updateUserName(
  userId: number,
  name: string
): Promise<DbUser> {
  const db = getDb();
  await db.execute({
    sql: "UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?",
    args: [name.trim(), userId],
  });
  return (await getUserById(userId))!;
}

export async function updateUserPassword(
  userId: number,
  passwordHash: string
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
    args: [passwordHash, userId],
  });
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface DbSession {
  id: number;
  user_id: number;
  token_hash: string;
  created_at: string;
  expires_at: string;
}

const SESSION_DAYS = parseInt(process.env.SESSION_LIFETIME_DAYS || "30", 10);

export async function createSession(
  userId: number
): Promise<{ token: string; session: DbSession }> {
  const db = getDb();
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = addDays(new Date(), SESSION_DAYS);

  await db.execute({
    sql: "INSERT INTO session_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    args: [userId, tokenHash, expiresAt],
  });

  const result = await db.execute({
    sql: "SELECT * FROM session_tokens WHERE token_hash = ?",
    args: [tokenHash],
  });

  return { token, session: rowAs<DbSession>(result.rows[0]) };
}

export async function findSession(
  token: string
): Promise<(DbSession & { user: DbUser }) | null> {
  const db = getDb();
  const tokenHash = hashToken(token);
  const result = await db.execute({
    sql: "SELECT * FROM session_tokens WHERE token_hash = ?",
    args: [tokenHash],
  });

  const session = rowAs<DbSession | undefined>(result.rows[0]);
  if (!session) return null;

  const expiresAt = new Date(session.expires_at + "Z");
  if (expiresAt < new Date()) {
    await db.execute({
      sql: "DELETE FROM session_tokens WHERE id = ?",
      args: [session.id],
    });
    return null;
  }

  const user = await getUserById(session.user_id);
  if (!user) return null;

  return { ...session, user };
}

export async function deleteSession(token: string): Promise<void> {
  const db = getDb();
  const tokenHash = hashToken(token);
  await db.execute({
    sql: "DELETE FROM session_tokens WHERE token_hash = ?",
    args: [tokenHash],
  });
}

export async function deleteUserSessions(userId: number): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: "DELETE FROM session_tokens WHERE user_id = ?",
    args: [userId],
  });
}

// ---------------------------------------------------------------------------
// Password Reset Tokens
// ---------------------------------------------------------------------------

export async function createPasswordResetToken(
  userId: number
): Promise<string> {
  const db = getDb();
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString()
    .replace("T", " ")
    .replace("Z", "");

  await db.execute({
    sql: "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    args: [userId, tokenHash, expiresAt],
  });

  return token;
}

export async function consumePasswordResetToken(
  token: string
): Promise<number | null> {
  const db = getDb();
  const tokenHash = hashToken(token);

  const result = await db.execute({
    sql: "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used = 0",
    args: [tokenHash],
  });

  const record = rowAs<
    { id: number; user_id: number; expires_at: string }
    | undefined
  >(result.rows[0]);

  if (!record) return null;

  const expiresAt = new Date(record.expires_at + "Z");
  if (expiresAt < new Date()) return null;

  await db.execute({
    sql: "UPDATE password_reset_tokens SET used = 1 WHERE id = ?",
    args: [record.id],
  });

  return record.user_id;
}

// ---------------------------------------------------------------------------
// Resumes
// ---------------------------------------------------------------------------

export interface DbResume {
  id: number;
  user_id: number;
  filename: string;
  file_path: string | null;
  extracted_text: string;
  pages: number;
  uploaded_at: string;
}

export async function createResume(
  userId: number,
  filename: string,
  extractedText: string,
  pages: number,
  filePath: string | null = null
): Promise<DbResume> {
  const db = getDb();
  const result = await db.execute({
    sql: "INSERT INTO resumes (user_id, filename, extracted_text, pages, file_path) VALUES (?, ?, ?, ?, ?)",
    args: [userId, filename, extractedText, pages, filePath],
  });
  return (await getResumeById(Number(result.lastInsertRowid)))!;
}

export async function getResumeById(id: number): Promise<DbResume | null> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM resumes WHERE id = ?",
    args: [id],
  });
  return rowAs<DbResume>(result.rows[0]) ?? null;
}

export async function getResumeScoped(
  resumeId: number,
  userId: number
): Promise<DbResume | null> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM resumes WHERE id = ? AND user_id = ?",
    args: [resumeId, userId],
  });
  return rowAs<DbResume>(result.rows[0]) ?? null;
}

export async function listResumes(userId: number): Promise<DbResume[]> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM resumes WHERE user_id = ? ORDER BY uploaded_at DESC",
    args: [userId],
  });
  return rowsAs<DbResume>(result.rows);
}

export async function resumeHasInterviews(resumeId: number): Promise<boolean> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT COUNT(*) as cnt FROM interviews WHERE resume_id = ?",
    args: [resumeId],
  });
  return Number(result.rows[0].cnt) > 0;
}

export async function deleteResume(resumeId: number): Promise<void> {
  const db = getDb();
  await db.execute({ sql: "DELETE FROM resumes WHERE id = ?", args: [resumeId] });
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export interface DbJob {
  id: number;
  user_id: number;
  role: string;
  company: string;
  experience: string;
  description: string;
  created_at: string;
}

export async function createJob(
  userId: number,
  role: string,
  company: string,
  experience: string,
  description: string
): Promise<DbJob> {
  const db = getDb();
  const result = await db.execute({
    sql: "INSERT INTO jobs (user_id, role, company, experience, description) VALUES (?, ?, ?, ?, ?)",
    args: [userId, role.trim(), company.trim(), experience, description.trim()],
  });
  return (await getJobById(Number(result.lastInsertRowid)))!;
}

export async function getJobById(id: number): Promise<DbJob | null> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM jobs WHERE id = ?",
    args: [id],
  });
  return rowAs<DbJob>(result.rows[0]) ?? null;
}

export async function getJobScoped(
  jobId: number,
  userId: number
): Promise<DbJob | null> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM jobs WHERE id = ? AND user_id = ?",
    args: [jobId, userId],
  });
  return rowAs<DbJob>(result.rows[0]) ?? null;
}

// ---------------------------------------------------------------------------
// Questions / Interviews / Answers
// ---------------------------------------------------------------------------

export interface DbQuestion {
  id: number;
  interview_id: number;
  question_text: string;
  question_number: number;
}

export interface DbAnswer {
  id: number;
  question_id: number;
  answer_text: string;
  score: number | null;
  feedback: string;
  audio_path: string | null;
  transcript: string | null;
  strengths: string;
  weaknesses: string;
  improvement: string;
  communication_notes: string;
  ai_error: string;
  audio_metrics: string;
  created_at: string;
}

export interface DbInterview {
  id: number;
  user_id: number;
  resume_id: number;
  job_id: number;
  status: string;
  score: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface InterviewWithDetails extends DbInterview {
  job: DbJob;
  questions: (DbQuestion & { answer: DbAnswer | null })[];
}

export async function createInterview(
  userId: number,
  resumeId: number,
  jobId: number,
  questionTexts: string[]
): Promise<InterviewWithDetails> {
  const db = getDb();
  const result = await db.execute({
    sql: "INSERT INTO interviews (user_id, resume_id, job_id) VALUES (?, ?, ?)",
    args: [userId, resumeId, jobId],
  });
  const interviewId = Number(result.lastInsertRowid);

  for (let i = 0; i < questionTexts.length; i++) {
    await db.execute({
      sql: "INSERT INTO questions (interview_id, question_text, question_number) VALUES (?, ?, ?)",
      args: [interviewId, questionTexts[i], i + 1],
    });
  }

  return (await getInterviewById(interviewId, userId))!;
}

export async function getInterviewById(
  interviewId: number,
  userId: number
): Promise<InterviewWithDetails | null> {
  const db = getDb();
  const ivResult = await db.execute({
    sql: "SELECT * FROM interviews WHERE id = ? AND user_id = ?",
    args: [interviewId, userId],
  });
  const interview = rowAs<DbInterview | undefined>(ivResult.rows[0]);
  if (!interview) return null;

  const job = (await getJobById(interview.job_id))!;

  const qResult = await db.execute({
    sql: "SELECT * FROM questions WHERE interview_id = ? ORDER BY question_number",
    args: [interviewId],
  });
  const questions = rowsAs<DbQuestion>(qResult.rows);

  const questionsWithAnswers: (DbQuestion & { answer: DbAnswer | null })[] =
    [];

  for (const q of questions) {
    const aResult = await db.execute({
      sql: "SELECT * FROM answers WHERE question_id = ?",
      args: [q.id],
    });
    const answer = rowAs<DbAnswer | null>(aResult.rows[0]) ?? null;
    questionsWithAnswers.push({ ...q, answer });
  }

  return { ...interview, job, questions: questionsWithAnswers };
}

export async function listInterviews(
  userId: number
): Promise<
  (DbInterview & {
    job: DbJob;
    total_questions: number;
    answered_questions: number;
  })[]
> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM interviews WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
  const interviews = rowsAs<DbInterview>(result.rows);

  const output: (DbInterview & {
    job: DbJob;
    total_questions: number;
    answered_questions: number;
  })[] = [];

  for (const iv of interviews) {
    const job = (await getJobById(iv.job_id))!;
    const qCount = await db.execute({
      sql: "SELECT COUNT(*) as cnt FROM questions WHERE interview_id = ?",
      args: [iv.id],
    });
    const aCount = await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM answers a
            JOIN questions q ON a.question_id = q.id
            WHERE q.interview_id = ? AND LENGTH(TRIM(a.answer_text)) > 0`,
      args: [iv.id],
    });
    output.push({
      ...iv,
      job,
      total_questions: Number(qCount.rows[0].cnt),
      answered_questions: Number(aCount.rows[0].cnt),
    });
  }

  return output;
}

export async function deleteInterview(interviewId: number): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: "DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE interview_id = ?)",
    args: [interviewId],
  });
  await db.execute({
    sql: "DELETE FROM questions WHERE interview_id = ?",
    args: [interviewId],
  });
  await db.execute({
    sql: "DELETE FROM interviews WHERE id = ?",
    args: [interviewId],
  });
}

export async function upsertAnswer(
  questionId: number,
  answerText: string,
  transcript: string | null = null,
  audioPath: string | null = null
): Promise<DbAnswer> {
  const db = getDb();
  const existing = await db.execute({
    sql: "SELECT * FROM answers WHERE question_id = ?",
    args: [questionId],
  });

  if (existing.rows.length > 0) {
    await db.execute({
      sql: `UPDATE answers SET answer_text = ?, score = ?,
            transcript = COALESCE(?, transcript),
            audio_path = COALESCE(?, audio_path),
            feedback = 'Placeholder feedback',
            strengths = '', weaknesses = '', improvement = '', communication_notes = ''
            WHERE question_id = ?`,
      args: [answerText, placeholderScore(answerText), transcript, audioPath, questionId],
    });
  } else {
    await db.execute({
      sql: `INSERT INTO answers (question_id, answer_text, score, feedback, transcript, audio_path)
            VALUES (?, ?, ?, 'Placeholder feedback', ?, ?)`,
      args: [questionId, answerText, placeholderScore(answerText), transcript, audioPath],
    });
  }

  const result = await db.execute({
    sql: "SELECT * FROM answers WHERE question_id = ?",
    args: [questionId],
  });
  return rowAs<DbAnswer>(result.rows[0]);
}

export async function applyEvaluation(
  questionId: number,
  evaluation: Record<string, unknown>
): Promise<DbAnswer> {
  const db = getDb();
  await db.execute({
    sql: `UPDATE answers SET
      score = ?, feedback = ?, strengths = ?, weaknesses = ?,
      improvement = ?, communication_notes = ?, ai_error = ''
      WHERE question_id = ?`,
    args: [
      Number(evaluation.score),
      String(evaluation.feedback || ""),
      encodeStrList((evaluation.strengths as string[]) || []),
      encodeStrList((evaluation.weaknesses as string[]) || []),
      String(evaluation.improvement || ""),
      String(evaluation.communication_notes || ""),
      questionId,
    ],
  });
  const result = await db.execute({
    sql: "SELECT * FROM answers WHERE question_id = ?",
    args: [questionId],
  });
  return rowAs<DbAnswer>(result.rows[0]);
}

export async function applyAiError(
  questionId: number,
  message: string
): Promise<DbAnswer> {
  const db = getDb();
  await db.execute({
    sql: `UPDATE answers SET
      feedback = 'Answer saved. Local AI evaluation is unavailable right now, so a placeholder score was used.',
      ai_error = ?
      WHERE question_id = ?`,
    args: [message, questionId],
  });
  const result = await db.execute({
    sql: "SELECT * FROM answers WHERE question_id = ?",
    args: [questionId],
  });
  return rowAs<DbAnswer>(result.rows[0]);
}

export function placeholderScore(answerText: string): number {
  const wordCount = answerText.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(Math.min(9.0, 5.0 + wordCount * 0.05) * 10) / 10;
}

export async function finishInterview(
  interviewId: number
): Promise<{
  interview_id: number;
  status: string;
  overall_score: number;
  total_questions: number;
  answered_questions: number;
}> {
  const db = getDb();
  const scores = await db.execute({
    sql: `SELECT a.score FROM answers a
          JOIN questions q ON a.question_id = q.id
          WHERE q.interview_id = ? AND a.score IS NOT NULL`,
    args: [interviewId],
  });

  const scoreValues = scores.rows.map((r) => Number(r.score));
  const overallScore =
    scoreValues.length > 0
      ? Math.round(
          (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) * 100
        ) / 100
      : 0;

  await db.execute({
    sql: `UPDATE interviews SET status = 'completed', score = ?, completed_at = datetime('now') WHERE id = ?`,
    args: [overallScore, interviewId],
  });

  const qCount = await db.execute({
    sql: "SELECT COUNT(*) as cnt FROM questions WHERE interview_id = ?",
    args: [interviewId],
  });
  const aCount = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM answers a
          JOIN questions q ON a.question_id = q.id
          WHERE q.interview_id = ? AND LENGTH(TRIM(a.answer_text)) > 0`,
    args: [interviewId],
  });

  return {
    interview_id: interviewId,
    status: "completed",
    overall_score: overallScore,
    total_questions: Number(qCount.rows[0].cnt),
    answered_questions: Number(aCount.rows[0].cnt),
  };
}

export async function buildResults(interviewId: number) {
  const db = getDb();
  const ivResult = await db.execute({
    sql: "SELECT * FROM interviews WHERE id = ?",
    args: [interviewId],
  });
  const interview = rowAs<DbInterview>(ivResult.rows[0]);

  const qResult = await db.execute({
    sql: "SELECT * FROM questions WHERE interview_id = ? ORDER BY question_number",
    args: [interviewId],
  });
  const questions = rowsAs<DbQuestion>(qResult.rows);

  const resultQuestions = [];

  for (const q of questions) {
    const aResult = await db.execute({
      sql: "SELECT * FROM answers WHERE question_id = ?",
      args: [q.id],
    });
    const answer = rowAs<DbAnswer | undefined>(aResult.rows[0]);

    resultQuestions.push({
      question_number: q.question_number,
      question_text: q.question_text,
      answer_text: answer?.answer_text ?? null,
      score: answer?.score ?? null,
      feedback: answer?.feedback ?? null,
      audio_path: answer?.audio_path ?? null,
      transcript: answer?.transcript ?? null,
      strengths: answer ? decodeStrList(answer.strengths) : [],
      weaknesses: answer ? decodeStrList(answer.weaknesses) : [],
      improvement: answer?.improvement ?? "",
      communication_notes: answer?.communication_notes ?? "",
      ai_error: answer?.ai_error ?? "",
      audio_metrics: answer ? decodeDict(answer.audio_metrics) : {},
    });
  }

  return {
    interview_id: interview.id,
    status: interview.status,
    overall_score: interview.score,
    total_questions: questions.length,
    questions: resultQuestions,
  };
}

// ---------------------------------------------------------------------------
// User Stats
// ---------------------------------------------------------------------------

export async function buildUserStats(userId: number) {
  const db = getDb();

  const scores = await db.execute({
    sql: `SELECT score FROM interviews
          WHERE user_id = ? AND status = 'completed' AND score IS NOT NULL`,
    args: [userId],
  });
  const scoreValues = scores.rows.map((r) => Number(r.score));

  const completedCount = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM interviews WHERE user_id = ? AND status = 'completed'`,
    args: [userId],
  });

  const questionsAnswered = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM answers a
          JOIN questions q ON a.question_id = q.id
          JOIN interviews i ON q.interview_id = i.id
          WHERE i.user_id = ? AND LENGTH(TRIM(a.answer_text)) > 0`,
    args: [userId],
  });

  return {
    interviews_completed: Number(completedCount.rows[0].cnt),
    average_score:
      scoreValues.length > 0
        ? Math.round(
            (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) * 10
          ) / 10
        : null,
    best_score:
      scoreValues.length > 0 ? Math.max(...scoreValues) : null,
    questions_answered: Number(questionsAnswered.rows[0].cnt),
  };
}

// ---------------------------------------------------------------------------
// Skills / Questions (deterministic fallback)
// ---------------------------------------------------------------------------

const COMMON_SKILLS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Python",
  "Java",
  "C++",
  "SQL",
  "MongoDB",
  "AWS",
  "Docker",
  "Git",
  "HTML",
  "CSS",
  "Tailwind",
  "REST API",
  "Machine Learning",
  "Data Analysis",
  "Figma",
];

export function extractSkills(resumeText: string): string[] {
  const lower = resumeText.toLowerCase();
  return COMMON_SKILLS.filter((s) => lower.includes(s.toLowerCase())).slice(0, 3);
}

function formatSkillList(skills: string[]): string {
  if (skills.length === 1) return skills[0];
  return skills.slice(0, -1).join(", ") + " and " + skills[skills.length - 1];
}

export function buildQuestions(
  role: string,
  company: string,
  experience: string,
  skills: string[]
): string[] {
  const atCompany = company ? ` at ${company}` : "";

  let experienceQuestion: string;
  switch (experience) {
    case "Fresher":
      experienceQuestion =
        "You are at the very start of your career. What project or coursework are you most proud of, and what did it teach you about working like a professional?";
      break;
    case "0–1 Years":
      experienceQuestion =
        "You have recently started working professionally. What is the biggest difference between academic projects and real-world work for you?";
      break;
    case "1–2 Years":
      experienceQuestion =
        "With one to two years of experience, which part of your craft have you improved the most, and how did that improvement show in your work?";
      break;
    case "2–5 Years":
      experienceQuestion =
        "At your level, teams expect ownership. Tell me about a feature or project you drove end to end and the impact it had.";
      break;
    case "5+ Years":
      experienceQuestion =
        "As a senior candidate, tell me about a time you influenced an architectural decision or mentored other engineers. What was the outcome?";
      break;
    default:
      experienceQuestion =
        "What has been the biggest challenge in your professional journey so far, and what did you learn from it?";
  }

  const skillQuestion = skills.length > 0
    ? `I noticed ${formatSkillList(skills)} on your resume. Describe a specific situation where you used ${skills[0]} to solve a real problem.`
    : `What technical strengths would you bring to this ${role} position, and how have you applied them so far?`;

  const companyClause = company ? ` — you are interviewing with ${company}` : "";

  return [
    `Tell me about yourself and why you are interested in the ${role} role${atCompany}.`,
    experienceQuestion,
    skillQuestion,
    `Walk me through the most challenging technical problem you have solved so far, and how it prepared you to work as a ${role}.`,
    `Last one${companyClause}: imagine a deadline is at risk and your lead is unavailable. What exactly do you do, and how do you communicate it?`,
  ];
}

export function jobDescriptionText(job: DbJob): string {
  const parts: string[] = [];
  if (job.role) parts.push(`Target role: ${job.role}`);
  if (job.company) parts.push(`Company: ${job.company}`);
  if (job.description) parts.push(job.description);
  return parts.join("\n");
}
