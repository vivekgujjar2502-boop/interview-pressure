import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import { findSession, createResume } from "@/lib/crud";
import { withErrorHandling, apiError } from "@/lib/api-helpers";
import { getDocumentProxy, extractText } from "unpdf";

export const runtime = "nodejs";
export const maxDuration = 30;

const SESSION_COOKIE = "ip_session";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await findSession(token);
  return session?.user ?? null;
}

async function extractPdfText(
  data: Uint8Array
): Promise<{ text: string; pages: number }> {
  const pdf = await getDocumentProxy(data);
  const result = await extractText(pdf);
  const text = result.text.join("\n\n").trim();
  return { text, pages: result.totalPages };
}

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    await initDb();
    const user = await getCurrentUser();
    if (!user) {
      return apiError("Unauthorized", 401);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return apiError("Invalid form data.", 422);
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return apiError("No file provided.");
    }

    const filename = file.name || "resume.pdf";
    if (!filename.toLowerCase().endsWith(".pdf")) {
      return apiError("Only PDF files are supported.");
    }

    const MAX_PDF_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_PDF_BYTES) {
      return apiError("Resume is too large. Maximum size is 10 MB.", 413);
    }

    let extractedText = "";
    let pageCount = 0;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const result = await extractPdfText(data);
      extractedText = result.text;
      pageCount = result.pages;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[resume/upload] PDF parse failed:", detail);
      return apiError(
        `This PDF could not be processed: ${detail.slice(0, 200)}`
      );
    }

    if (pageCount > 0 && !extractedText) {
      return apiError(
        "The PDF was readable but contains no extractable text. " +
          "It may be a scanned image or use non-standard fonts."
      );
    }

    const resume = await createResume(
      user.id,
      filename,
      extractedText,
      pageCount,
      null
    );

    return NextResponse.json({
      id: resume.id,
      filename: resume.filename,
      text: resume.extracted_text,
      pages: resume.pages,
    });
  });
}
