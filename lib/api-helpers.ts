import { NextResponse } from "next/server";

export function apiError(detail: string, status = 400) {
  return NextResponse.json({ detail }, { status });
}

export function apiServerError(message: string) {
  return NextResponse.json(
    { detail: message },
    { status: 500 }
  );
}

export async function withErrorHandling(
  fn: () => Promise<Response>
): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[API Error]", message, err);
    return apiServerError(message);
  }
}
