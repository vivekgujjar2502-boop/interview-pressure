const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b";
const REQUEST_TIMEOUT = parseFloat(
  process.env.OLLAMA_TIMEOUT || "180"
) * 1000;

const MAX_RESUME_CHARS = 3000;

export class OllamaSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OllamaSetupError";
  }
}

export class AiResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiResponseError";
  }
}

async function chatJson(
  messages: { role: string; content: string }[],
  temperature = 0.2
): Promise<Record<string, unknown>> {
  const payload = {
    model: OLLAMA_MODEL,
    messages,
    stream: false,
    format: "json",
    options: { temperature },
  };

  let response: Response;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new OllamaSetupError(
        `Ollama request timed out after ${REQUEST_TIMEOUT / 1000}s.`
      );
    }
    throw new OllamaSetupError(
      `Could not reach the local Ollama server at ${OLLAMA_BASE_URL}. ` +
        "Install Ollama from https://ollama.com/download and make sure it is started."
    );
  }

  if (response.status === 404) {
    throw new OllamaSetupError(
      `AI model '${OLLAMA_MODEL}' is not installed. Run: ollama pull ${OLLAMA_MODEL}`
    );
  }

  if (!response.ok) {
    throw new OllamaSetupError(
      `Ollama server error (HTTP ${response.status}).`
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await response.json();
  } catch {
    throw new AiResponseError("Ollama returned a non-JSON response.");
  }

  const message = (body.message as Record<string, string>) || {};
  let content = (message.content || "").trim();
  if (!content && body.response) {
    content = String(body.response).trim();
  }

  if (!content) {
    throw new AiResponseError("Ollama returned an empty response.");
  }

  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new AiResponseError("Ollama response was not valid JSON.");
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      throw new AiResponseError("Ollama response was not valid JSON.");
    }
  }
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

const EVALUATION_SYSTEM_PROMPT = `You are an interview answer evaluator for a mock interview platform.
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
}`;

function cleanStr(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(cleanStr).filter(Boolean);
}

function parseEvaluation(data: Record<string, unknown>): Record<string, unknown> {
  if (!("score" in data)) {
    throw new AiResponseError("AI response was missing required fields.");
  }

  let score: number;
  try {
    score = Math.round(Number(data.score));
  } catch {
    throw new AiResponseError("AI returned a non-numeric score.");
  }

  score = Math.max(0, Math.min(10, score));

  return {
    score,
    feedback: cleanStr(data.feedback),
    strengths: cleanList(data.strengths),
    weaknesses: cleanList(data.weaknesses),
    improvement: cleanStr(data.improvement),
    communication_notes: cleanStr(data.communication_notes),
  };
}

export async function evaluateAnswer(
  question: string,
  transcript: string,
  resumeText = "",
  jobDescription = ""
): Promise<Record<string, unknown>> {
  const userParts = [`Interview question:\n${question}`];

  if (resumeText.trim()) {
    userParts.push(
      "Candidate resume excerpt:\n" + resumeText.trim().slice(0, MAX_RESUME_CHARS)
    );
  }
  if (jobDescription.trim()) {
    userParts.push(`Job description:\n${jobDescription.trim()}`);
  }

  userParts.push(`Candidate answer transcript:\n${transcript}`);

  const prompt = userParts.join("\n\n");
  let messages = [
    { role: "system", content: EVALUATION_SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await chatJson(messages);
      return parseEvaluation(data);
    } catch (err) {
      lastError = err as Error;
      messages = [
        { role: "system", content: EVALUATION_SYSTEM_PROMPT },
        {
          role: "user",
          content:
            prompt +
            "\n\nIMPORTANT: Reply with ONLY one JSON object with keys: score, feedback, strengths, weaknesses, improvement, communication_notes.",
        },
      ];
    }
  }

  throw lastError || new AiResponseError("AI evaluation failed.");
}

// ---------------------------------------------------------------------------
// Question generation
// ---------------------------------------------------------------------------

const QUESTION_SYSTEM_PROMPT = `You generate mock interview questions.
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
- Respond ONLY with a single JSON object: {"questions": ["...", "..."]}`;

export async function generateQuestions(
  resumeText: string,
  role: string,
  company: string,
  experience: string,
  jobDescription = ""
): Promise<string[]> {
  const userParts = [
    `Target role: ${role}`,
    `Candidate experience level: ${experience}`,
  ];
  if (company.trim()) userParts.push(`Company: ${company.trim()}`);
  if (jobDescription.trim()) {
    userParts.push(
      `Job description:\n${jobDescription.trim().slice(0, MAX_RESUME_CHARS)}`
    );
  }
  if (resumeText.trim()) {
    userParts.push(
      "Candidate resume:\n" + resumeText.trim().slice(0, MAX_RESUME_CHARS)
    );
  }

  const data = await chatJson([
    { role: "system", content: QUESTION_SYSTEM_PROMPT },
    { role: "user", content: userParts.join("\n") },
  ]);

  const rawQuestions = data.questions;
  if (!Array.isArray(rawQuestions)) {
    throw new AiResponseError("AI did not return a questions list.");
  }

  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const item of rawQuestions) {
    const text = cleanStr(item);
    if (!text || text.length > 400) continue;
    const key = text.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(text);
  }

  if (cleaned.length < 5) {
    throw new AiResponseError("AI returned fewer than 5 usable questions.");
  }

  return cleaned.slice(0, 5);
}
