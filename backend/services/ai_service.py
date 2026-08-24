"""Centralized Ollama communication.

Every call to the local LLM goes through this module — no other file
talks to Ollama directly. All processing is local; no paid APIs.
"""

import json
import os
import re

import httpx

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
REQUEST_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT", "180"))

MAX_RESUME_CHARS = 3000
MAX_ATTEMPTS = 2
FILLER_WORDS = [
    "um",
    "uh",
    "er",
    "ah",
    "like",
    "you know",
    "basically",
    "actually",
    "literally",
    "i mean",
]


class OllamaSetupError(RuntimeError):
    """Raised when the local Ollama server or model is unavailable."""


class AiResponseError(RuntimeError):
    """Raised when Ollama returns an unusable response."""


def _chat_json(messages: list[dict], temperature: float = 0.2) -> dict:
    """POST to the local Ollama chat API and return a parsed JSON object."""
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "format": "json",
        "options": {"temperature": temperature},
    }

    try:
        response = httpx.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except httpx.ConnectError:
        raise OllamaSetupError(
            f"Ollama is not running at {OLLAMA_BASE_URL}. "
            "Install Ollama from https://ollama.com/download/windows "
            "and make sure it is started."
        )
    except httpx.HTTPError as exc:
        raise OllamaSetupError(
            f"Could not reach the local Ollama server at "
            f"{OLLAMA_BASE_URL}: {exc}"
        )

    if response.status_code == 404:
        raise OllamaSetupError(
            f"AI model '{OLLAMA_MODEL}' is not installed. "
            f"Run: ollama pull {OLLAMA_MODEL}"
        )

    if response.status_code != 200:
        raise OllamaSetupError(
            f"Ollama server error (HTTP {response.status_code})."
        )

    try:
        body = response.json()
    except ValueError:
        raise AiResponseError("Ollama returned a non-JSON response.")

    message = body.get("message") or {}
    content = str(message.get("content") or "").strip()
    if not content and "response" in body:
        content = str(body.get("response") or "").strip()

    if not content:
        raise AiResponseError("Ollama returned an empty response.")

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if not match:
            raise AiResponseError("Ollama response was not valid JSON.")
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            raise AiResponseError("Ollama response was not valid JSON.")

    if not isinstance(data, dict):
        raise AiResponseError("Ollama response was not a JSON object.")

    return data


def check_ollama_ready() -> str | None:
    """Return None if Ollama is reachable and the model is installed,
    otherwise a human-readable setup message."""
    try:
        response = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
    except httpx.HTTPError:
        return (
            f"Ollama is not running at {OLLAMA_BASE_URL}. "
            "Install it from https://ollama.com/download/windows and start it."
        )

    if response.status_code != 200:
        return f"Ollama server responded unexpectedly (HTTP {response.status_code})."

    model_names = [
        entry.get("name", "") for entry in response.json().get("models", [])
    ]
    base_name = OLLAMA_MODEL.split(":")[0]

    for name in model_names:
        if name == OLLAMA_MODEL or name.split(":")[0] == base_name:
            return None

    return (
        f"AI model '{OLLAMA_MODEL}' is not installed. "
        f"Run: ollama pull {OLLAMA_MODEL}"
    )


def _clean_str(value) -> str:
    return "" if value is None else str(value).strip()


def _clean_list(value) -> list:
    if not isinstance(value, list):
        return []
    return [_clean_str(item) for item in value if _clean_str(item)]


# ---------------------------------------------------------------------------
# Answer evaluation
# ---------------------------------------------------------------------------

EVALUATION_SYSTEM_PROMPT = """You are an interview answer evaluator for a mock interview platform.
Evaluate the candidate's spoken or typed answer against the interview question.

Score the answer from 0 to 10 based ONLY on:
- Relevance: does it address the question?
- Correctness: is the technical or factual content accurate?
- Completeness: does it cover the important parts?
- Role suitability: does it fit the target role?
- Communication: is it clear, well structured and specific?
- Structure: does it have a logical flow (situation, action, result)?
- Specificity: does it use concrete examples instead of vague claims?

Rules:
- Respond ONLY with a single JSON object. No extra text.
- Base every statement on observable content of the answer.
- Never speculate about emotions, personality traits, honesty, effort, confidence or mental state.
- If the transcript is empty or completely unrelated to the question, give a low score and say why.

Respond with exactly this JSON structure:
{
  "score": <integer 0-10>,
  "feedback": "<2-4 sentence overall assessment>",
  "strengths": ["<short point>", ...],
  "weaknesses": ["<short point>", ...],
  "improvement": "<one concrete suggestion>",
  "communication_notes": "<1-2 sentences about clarity and structure>"
}"""


def _parse_evaluation(data: dict) -> dict:
    if "score" not in data:
        raise AiResponseError("AI response was missing required fields.")

    try:
        score = round(float(data["score"]))
    except (TypeError, ValueError):
        raise AiResponseError("AI returned a non-numeric score.")

    score = max(0, min(10, score))

    return {
        "score": score,
        "feedback": _clean_str(data.get("feedback")),
        "strengths": _clean_list(data.get("strengths")),
        "weaknesses": _clean_list(data.get("weaknesses")),
        "improvement": _clean_str(data.get("improvement")),
        "communication_notes": _clean_str(data.get("communication_notes")),
    }


def evaluate_answer(
    question: str,
    transcript: str,
    resume_text: str = "",
    job_description: str = "",
) -> dict:
    """Evaluate an interview answer using the local Ollama LLM.

    Returns dict with keys: score, feedback, strengths, weaknesses,
    improvement, communication_notes.

    Raises OllamaSetupError / AiResponseError — callers translate those
    into graceful fallbacks.
    """
    user_parts = [f"Interview question:\n{question}"]

    if resume_text.strip():
        user_parts.append(
            "Candidate resume excerpt:\n"
            + resume_text.strip()[:MAX_RESUME_CHARS]
        )
    if job_description.strip():
        user_parts.append(f"Job description:\n{job_description.strip()}")

    user_parts.append(f"Candidate answer transcript:\n{transcript}")

    prompt = "\n\n".join(user_parts)
    messages = [
        {"role": "system", "content": EVALUATION_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    last_error: Exception | None = None

    for attempt in range(MAX_ATTEMPTS):
        try:
            data = _chat_json(messages)
            return _parse_evaluation(data)
        except AiResponseError as exc:
            last_error = exc
            messages = [
                {"role": "system", "content": EVALUATION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": prompt
                    + "\n\nIMPORTANT: Reply with ONLY one JSON object with "
                    "keys: score, feedback, strengths, weaknesses, "
                    "improvement, communication_notes.",
                },
            ]

    raise last_error or AiResponseError("AI evaluation failed.")


# ---------------------------------------------------------------------------
# Question generation
# ---------------------------------------------------------------------------

QUESTION_SYSTEM_PROMPT = """You generate mock interview questions.
Generate exactly 5 realistic interview questions for a candidate, in this order:
1. Introduction (tell me about yourself / motivation)
2. Resume-based (about their actual experience, projects or skills)
3. Technical or role-specific
4. Situational (a realistic work scenario)
5. Behavioral (past behavior, teamwork, challenges)

Rules:
- Questions must relate to the provided resume, role and description.
- No duplicate or near-duplicate questions.
- No discriminatory, unsafe or inappropriate questions.
- Each question must be at most 60 words.
- Respond ONLY with a single JSON object: {"questions": ["...", "..."]}"""


def generate_questions(
    resume_text: str,
    role: str,
    company: str,
    experience: str,
    job_description: str = "",
) -> list[str]:
    """Generate 5 personalized questions via local Ollama.

    Raises OllamaSetupError / AiResponseError so callers can fall back
    to the deterministic generator.
    """
    user_parts = [
        f"Target role: {role}",
        f"Candidate experience level: {experience}",
    ]
    if company.strip():
        user_parts.append(f"Company: {company.strip()}")
    if job_description.strip():
        user_parts.append(
            f"Job description:\n{job_description.strip()[:MAX_RESUME_CHARS]}"
        )
    if resume_text.strip():
        user_parts.append(
            "Candidate resume:\n" + resume_text.strip()[:MAX_RESUME_CHARS]
        )

    messages = [
        {"role": "system", "content": QUESTION_SYSTEM_PROMPT},
        {"role": "user", "content": "\n".join(user_parts)},
    ]

    data = _chat_json(messages)
    raw_questions = data.get("questions")

    if not isinstance(raw_questions, list):
        raise AiResponseError("AI did not return a questions list.")

    seen: set[str] = set()
    cleaned: list[str] = []

    for item in raw_questions:
        text = _clean_str(item)

        if not text or len(text) > 400:
            continue

        key = re.sub(r"[^a-z0-9]", "", text.lower())
        if key in seen:
            continue

        seen.add(key)
        cleaned.append(text)

    if len(cleaned) < 5:
        raise AiResponseError("AI returned fewer than 5 usable questions.")

    return cleaned[:5]
