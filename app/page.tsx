import Link from "next/link";

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Upload Resume",
    text: "Your PDF is parsed locally so questions can reference your real experience.",
  },
  {
    step: "2",
    title: "Add Job Details",
    text: "Target role, company and experience level shape every question you get.",
  },
  {
    step: "3",
    title: "Practice Interview",
    text: "Answer five personalized questions with your voice or by typing — one at a time.",
  },
  {
    step: "4",
    title: "Get AI Feedback",
    text: "Every answer is scored locally with strengths, weaknesses and concrete improvements.",
  },
];

const FEATURES = [
  {
    icon: "📄",
    title: "Resume-based questions",
    text: "Questions reference your actual skills, projects and experience from your uploaded resume.",
  },
  {
    icon: "🎙",
    title: "Voice interview",
    text: "Record your answers in the browser. Transcription runs locally with Whisper — audio never leaves your machine.",
  },
  {
    icon: "🤖",
    title: "Local AI evaluation",
    text: "A local Ollama model scores relevance, correctness, completeness and communication for every answer.",
  },
  {
    icon: "📊",
    title: "Interview analytics",
    text: "See speaking time, pace, filler words and pauses alongside each answer's detailed feedback.",
  },
  {
    icon: "📈",
    title: "Progress tracking",
    text: "Keep a history of every mock interview and watch your average score climb over time.",
  },
];

export default function Home() {
  return (
    <main>
      <section className="text-center px-6 pt-20 pb-24 max-w-5xl mx-auto">
        <p className="text-blue-500 font-semibold mb-5 tracking-wide uppercase text-sm">
          AI-powered interview practice
        </p>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold leading-tight">
          Prepare for your
          <br />
          <span className="text-blue-500">real interview.</span>
        </h1>

        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mt-7 leading-relaxed">
          Upload your resume, add the job you are targeting, practice
          personalized questions out loud, and receive detailed AI feedback on
          every single answer.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/upload"
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-xl font-semibold text-lg transition"
          >
            Start Mock Interview →
          </Link>

          <Link
            href="#how-it-works"
            className="w-full sm:w-auto border border-gray-700 hover:bg-gray-900 px-8 py-4 rounded-xl font-semibold text-lg transition"
          >
            How it works
          </Link>
        </div>

        <p className="text-gray-600 text-sm mt-6">
          No real interviewer. No pressure. Just practice — fully local and
          private.
        </p>
      </section>

      <section id="how-it-works" className="max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-3xl font-bold text-center">How it works</h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
          {HOW_IT_WORKS.map((item) => (
            <div
              key={item.step}
              className="border border-gray-800 rounded-2xl p-7 bg-gray-950 hover:border-gray-600 transition"
            >
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-600/15 border border-blue-500/30 text-blue-400 font-bold">
                {item.step}
              </span>
              <h3 className="text-lg font-semibold mt-4">{item.title}</h3>
              <p className="text-gray-400 text-sm mt-2 leading-6">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-28">
        <h2 className="text-3xl font-bold text-center">
          Everything you need to walk in ready
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="border border-gray-800 rounded-2xl p-7 bg-gray-950 hover:border-gray-600 transition"
            >
              <div className="text-3xl mb-4" aria-hidden>
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm leading-6">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
