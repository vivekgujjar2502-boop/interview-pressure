import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import { findSession, getResumeScoped, deleteResume, resumeHasInterviews } from "@/lib/crud";
import { withErrorHandling, apiError } from "@/lib/api-helpers";

const SESSION_COOKIE = "ip_session";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await findSession(token);
  return session?.user ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resumeId: string }> }
) {
  return withErrorHandling(async () => {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return apiError("Unauthorized", 401);

    const { resumeId } = await params;
    const resume = await getResumeScoped(parseInt(resumeId, 10), user.id);
    if (!resume) return apiError("Resume not found.", 404);

    return NextResponse.json({
      id: resume.id,
      filename: resume.filename,
      text: resume.extracted_text,
      pages: resume.pages,
    });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ resumeId: string }> }
) {
  return withErrorHandling(async () => {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return apiError("Unauthorized", 401);

    const { resumeId } = await params;
    const id = parseInt(resumeId, 10);
    const resume = await getResumeScoped(id, user.id);
    if (!resume) return apiError("Resume not found.", 404);

    const hasInterviews = await resumeHasInterviews(id);
    if (hasInterviews) {
      return apiError(
        "This resume is used by existing interviews and cannot be deleted. Delete those interviews first.",
        409
      );
    }

    await deleteResume(id);
    return NextResponse.json({ message: "Resume deleted." });
  });
}
