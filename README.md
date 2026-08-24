# Interview Pressure

A local-only, AI-powered mock interview simulator. Upload your resume, enter
the job you are targeting, and practice a realistic interview with your voice.
Every answer is transcribed and evaluated by models running entirely on your
own machine — no paid APIs, no API keys, no data leaves your computer.

## Features

- **Accounts** — email + password sign up / login (PBKDF2-hashed passwords,
  bearer-token sessions). Password reset flow included; without an email
  provider it returns a dev-mode token you can paste into the reset page
  (`RESET_DEV_MODE=true`).
- **Resume upload** — PDF only (≤ 10 MB). Text extracted locally with
  `pypdf`; resumes are stored per-user and reusable across interviews.
- **Job targeting** — role, company (optional), pasted job description
  (optional) and experience level.
- **AI question generation** — Ollama generates personalized questions from
  resume + job context; if Ollama is not reachable, deterministic fallback
  questions keep the app usable.
- **Voice answers** — record answers in the browser, listen back, re-record,
  then submit. Transcription runs locally with `faster-whisper`.
- **Communication metrics** — words per minute, filler-word count and pause
  detection are computed from the transcript segments (observable indicators
  only — no medical or diagnostic claims).
- **AI evaluation** — each answer gets a 1–10 score plus strengths,
  weaknesses and one concrete improvement, powered by a local LLM through
  Ollama.
- **Results & history** — per-question breakdowns, overall summaries,
  dashboard stats and a filterable interview history.

## Tech Stack

| Layer      | Choice                                              |
| ---------- | --------------------------------------------------- |
| Frontend   | Next.js 16 (App Router), React 19, Tailwind CSS v4  |
| Backend    | FastAPI, SQLAlchemy 2, SQLite                       |
| STT        | faster-whisper (`base.en` by default)               |
| LLM        | Ollama (any chat model; `llama3.2:3b` recommended)  |
| PDF        | pypdf                                               |

## Prerequisites

1. **Node.js 20+**
2. **Python 3.12+**
3. **Ollama** (optional but recommended) — install from
   <https://ollama.com>, then pull a model:

   ```powershell
   ollama pull llama3.2:3b
   ```

   Without Ollama running the app still works: questions fall back to a
   built-in template and answers receive placeholder evaluations with a clear
   notice explaining how to set up the local model.

## Backend Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env   # adjust if needed
uvicorn main:app --reload --port 8000
```

The SQLite database (`backend/interview_pressure.db`) is created
automatically on first start. Recordings are stored under
`backend/media/audio/` and resumes under `backend/media/resumes/`.

### Environment Variables (backend/.env)

| Variable               | Default                  | Purpose                          |
| ---------------------- | ------------------------ | -------------------------------- |
| `DATABASE_URL`         | `sqlite:///./interview_pressure.db` | Any SQLAlchemy URL    |
| `OLLAMA_URL`           | `http://localhost:11434` | Local Ollama endpoint            |
| `OLLAMA_MODEL`         | `llama3.2:3b`            | Chat model used for Q&A          |
| `WHISPER_MODEL`        | `base.en`                | faster-whisper model size        |
| `SESSION_LIFETIME_DAYS`| `30`                     | Login session lifetime           |
| `RESET_DEV_MODE`       | `true`                   | Return reset tokens in API responses |

## Frontend Setup

```powershell
npm install
npm run dev     # http://localhost:3000
```

The frontend expects the API at `http://localhost:8000` (override with
`NEXT_PUBLIC_API_BASE_URL` in `.env.local`).

## Usage

1. Open <http://localhost:3000> and create an account.
2. Upload a resume (or reuse a previously uploaded one).
3. Enter the target role/company/description and experience level.
4. Answer each question by voice (record → review → submit) or typing;
   every answer must be submitted before moving on.
5. Finish the interview to see scores, communication metrics and feedback.
6. Review past interviews any time under **History**.

## Notes

- Everything runs on `localhost`: browser microphone access requires
  `http://localhost` (or HTTPS), which the dev server satisfies.
- The first transcription downloads the Whisper model (~75 MB for
  `base.en`); later runs are instant.
- To reset all data: stop both servers and delete
  `backend/interview_pressure.db` plus the `backend/media/` folder.
