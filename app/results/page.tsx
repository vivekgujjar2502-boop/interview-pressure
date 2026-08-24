"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const INTERVIEW_ID_STORAGE_KEY = "interview-pressure-interview-id";

export default function ResultsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const storedId = Number(
      sessionStorage.getItem(INTERVIEW_ID_STORAGE_KEY)
    );

    if (storedId) {
      router.replace(`/results/${storedId}`);
    } else {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <main className="px-6 py-24 text-center text-gray-500">
      Redirecting...
    </main>
  );
}
