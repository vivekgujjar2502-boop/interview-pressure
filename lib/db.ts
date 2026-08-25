import { createClient, type Client } from "@libsql/client";

let _client: Client | null = null;

export function getDb(): Client {
  if (!_client) {
    _client = createClient({
      url: process.env.DATABASE_URL || "file:./data.db",
    });
  }
  return _client;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS session_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS resumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL,
  file_path TEXT,
  extracted_text TEXT NOT NULL DEFAULT '',
  pages INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  experience TEXT NOT NULL DEFAULT 'Fresher',
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  resume_id INTEGER NOT NULL REFERENCES resumes(id),
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  status TEXT NOT NULL DEFAULT 'in_progress',
  score REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  interview_id INTEGER NOT NULL REFERENCES interviews(id),
  question_text TEXT NOT NULL,
  question_number INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL UNIQUE REFERENCES questions(id),
  answer_text TEXT NOT NULL DEFAULT '',
  score REAL,
  feedback TEXT NOT NULL DEFAULT '',
  audio_path TEXT,
  transcript TEXT,
  strengths TEXT NOT NULL DEFAULT '',
  weaknesses TEXT NOT NULL DEFAULT '',
  improvement TEXT NOT NULL DEFAULT '',
  communication_notes TEXT NOT NULL DEFAULT '',
  ai_error TEXT NOT NULL DEFAULT '',
  audio_metrics TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_session_tokens_user ON session_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_session_tokens_hash ON session_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_user ON interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_resume ON interviews(resume_id);
CREATE INDEX IF NOT EXISTS idx_interviews_job ON interviews(job_id);
CREATE INDEX IF NOT EXISTS idx_questions_interview ON questions(interview_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
`;

let _initialized = false;

export async function initDb() {
  if (_initialized) return;
  const db = getDb();
  const statements = SCHEMA.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await db.execute(stmt);
  }
  _initialized = true;
}
