export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const TOKEN_STORAGE_KEY = "interview-pressure-token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  const token = getStoredToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "The InterviewPressure backend is not running on port 8000. Start it with: python -m uvicorn main:app --reload --port 8000"
    );
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const data = await response.json();

      if (typeof data.detail === "string") {
        message = data.detail;
      } else if (Array.isArray(data.detail)) {
        message = data.detail
          .map((item: { msg?: string }) => item.msg ?? "Invalid input.")
          .join(" ");
      }
    } catch {
      // keep the default message
    }

    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface ResumeUploadResult {
  id: number;
  filename: string;
  text: string;
  pages: number;
}

export interface ResumeSummary {
  id: number;
  filename: string;
  pages: number;
  text_preview: string;
  uploaded_at: string;
}

export interface JobPayload {
  role: string;
  company: string;
  experience: string;
  description?: string;
}

export interface JobResult {
  id: number;
  role: string;
  company: string;
  experience: string;
  description: string;
}

export interface Question {
  id: number;
  question_number: number;
  question_text: string;
  answer_text: string | null;
}

export interface Interview {
  id: number;
  status: string;
  score: number | null;
  job_role: string;
  company: string;
  experience: string;
  questions: Question[];
}

export interface AudioMetrics {
  duration_seconds?: number;
  word_count?: number;
  words_per_minute?: number | null;
  filler_word_count?: number;
  pause_count?: number;
  pause_total_seconds?: number;
}

export interface AnswerResult {
  id: number;
  question_id: number;
  answer_text: string;
  score: number | null;
  feedback: string;
  audio_path: string | null;
  transcript: string | null;
  strengths: string[];
  weaknesses: string[];
  improvement: string;
  communication_notes: string;
  ai_error: string;
}

export interface TranscriptResult {
  question_id: number;
  transcript: string;
  audio_path: string;
  audio_metrics: AudioMetrics;
}

export interface FinishResult {
  interview_id: number;
  status: string;
  overall_score: number;
  total_questions: number;
  answered_questions: number;
}

export interface ResultQuestion {
  question_number: number;
  question_text: string;
  answer_text: string | null;
  score: number | null;
  feedback: string | null;
  audio_path: string | null;
  transcript: string | null;
  strengths: string[];
  weaknesses: string[];
  improvement: string;
  communication_notes: string;
  ai_error: string;
  audio_metrics: AudioMetrics;
}

export interface InterviewResults {
  interview_id: number;
  status: string;
  overall_score: number | null;
  total_questions: number;
  questions: ResultQuestion[];
}

export interface InterviewSummary {
  id: number;
  role: string;
  company: string;
  experience: string;
  status: string;
  score: number | null;
  created_at: string;
  completed_at: string | null;
  total_questions: number;
  answered_questions: number;
}

export interface DashboardStats {
  interviews_completed: number;
  average_score: number | null;
  best_score: number | null;
  questions_answered: number;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export function signup(payload: {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
}): Promise<AuthResult> {
  return request<AuthResult>("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function login(payload: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  return request<AuthResult>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchCurrentUser(): Promise<User> {
  return request<User>("/api/auth/me");
}

export function logout(): Promise<{ message: string }> {
  return request<{ message: string }>("/api/auth/logout", {
    method: "POST",
  });
}

export function updateProfile(payload: {
  name: string;
}): Promise<User> {
  return request<User>("/api/users/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function changePassword(payload: {
  current_password: string;
  new_password: string;
  confirm_new_password: string;
}): Promise<{ message: string; token: string }> {
  return request<{ message: string; token: string }>(
    "/api/auth/change-password",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

export function forgotPassword(email: string): Promise<{
  message: string;
  dev_reset_token: string | null;
}> {
  return request<{ message: string; dev_reset_token: string | null }>(
    "/api/auth/forgot-password",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }
  );
}

export function resetPassword(payload: {
  token: string;
  new_password: string;
  confirm_new_password: string;
}): Promise<{ message: string }> {
  return request<{ message: string }>("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Resumes / jobs / interviews
// ---------------------------------------------------------------------------

export function uploadResume(file: File): Promise<ResumeUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  return request<ResumeUploadResult>("/api/resumes/upload", {
    method: "POST",
    body: formData,
  });
}

export function listResumes(): Promise<ResumeSummary[]> {
  return request<ResumeSummary[]>("/api/resumes");
}

export function deleteResume(resumeId: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/resumes/${resumeId}`, {
    method: "DELETE",
  });
}

export function createJob(payload: JobPayload): Promise<JobResult> {
  return request<JobResult>("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function createInterview(payload: {
  resume_id: number;
  job_id: number;
}): Promise<Interview> {
  return request<Interview>("/api/interviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function listInterviews(): Promise<InterviewSummary[]> {
  return request<InterviewSummary[]>("/api/interviews");
}

export function getInterview(interviewId: number): Promise<Interview> {
  return request<Interview>(`/api/interviews/${interviewId}`);
}

export function deleteInterview(
  interviewId: number
): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/interviews/${interviewId}`, {
    method: "DELETE",
  });
}

export function transcribeAnswerAudio(
  interviewId: number,
  questionId: number,
  file: File
): Promise<TranscriptResult> {
  const formData = new FormData();
  formData.append("audio", file);

  return request<TranscriptResult>(
    `/api/interviews/${interviewId}/questions/${questionId}/audio`,
    {
      method: "POST",
      body: formData,
    }
  );
}

export function evaluateAnswer(
  interviewId: number,
  questionId: number,
  answerText: string
): Promise<AnswerResult> {
  return request<AnswerResult>(
    `/api/interviews/${interviewId}/questions/${questionId}/evaluate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer_text: answerText }),
    }
  );
}

export function finishInterview(interviewId: number): Promise<FinishResult> {
  return request<FinishResult>(`/api/interviews/${interviewId}/finish`, {
    method: "POST",
  });
}

export function getInterviewResults(
  interviewId: number
): Promise<InterviewResults> {
  return request<InterviewResults>(`/api/interviews/${interviewId}/results`);
}

export function getDashboardStats(): Promise<DashboardStats> {
  return request<DashboardStats>("/api/users/me/stats");
}
