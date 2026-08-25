import Link from "next/link";

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Upload Resume",
    text: "Your PDF is parsed server-side so questions can reference your real experience.",
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
    <main className="page-enter">
      {/* Hero */}
      <section className="relative text-center px-6 pt-24 pb-28 max-w-5xl mx-auto overflow-hidden">
        {/* Subtle gradient glow behind hero */}
        <div
          aria-hidden
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20 blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, rgba(96,165,250,0.4) 0%, rgba(167,139,250,0.2) 50%, transparent 80%)",
          }}
        />

        <p className="relative text-accent font-semibold mb-6 tracking-wide uppercase text-xs">
          AI-powered interview practice
        </p>

        <h1 className="relative text-4xl sm:text-6xl md:text-7xl font-bold leading-[1.1] tracking-tight">
          Prepare for your
          <br />
          <span className="gradient-text">real interview.</span>
        </h1>

        <p className="relative text-secondary-text text-lg md:text-xl max-w-2xl mx-auto mt-8 leading-relaxed">
          Upload your resume, add the job you are targeting, practice
          personalized questions out loud, and receive detailed AI feedback on
          every single answer.
        </p>

        <div className="relative mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/upload"
            className="group w-full sm:w-auto bg-accent hover:bg-accent-hover px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200 shadow-lg shadow-accent/10 hover:shadow-accent/20"
          >
            Start Mock Interview
            <span className="inline-block ml-1 transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>

          <Link
            href="#how-it-works"
            className="w-full sm:w-auto border border-border-d hover:bg-white/5 px-8 py-4 rounded-xl font-semibold text-base text-secondary-text hover:text-primary-text transition-all duration-200"
          >
            How it works
          </Link>
        </div>

        <p className="relative text-muted-text text-sm mt-8">
          No real interviewer. No pressure. Just practice — fully local and
          private.
        </p>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="max-w-6xl mx-auto px-6 pb-28"
      >
        <h2 className="text-3xl font-bold text-center tracking-tight">
          How it works
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
          {HOW_IT_WORKS.map((item) => (
            <div
              key={item.step}
              className="group border border-border-s bg-surface/60 rounded-2xl p-7 hover:border-border-d hover:bg-surface transition-all duration-300"
            >
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-accent/10 border border-accent/20 text-accent font-bold text-sm">
                {item.step}
              </span>
              <h3 className="text-base font-semibold mt-4 text-primary-text">
                {item.title}
              </h3>
              <p className="text-secondary-text text-sm mt-2 leading-relaxed">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-32">
        <h2 className="text-3xl font-bold text-center tracking-tight">
          Everything you need to walk in ready
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-14">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group border border-border-s bg-surface/60 rounded-2xl p-7 hover:border-border-d hover:bg-surface transition-all duration-300"
            >
              <div className="text-3xl mb-4" aria-hidden>
                {feature.icon}
              </div>
              <h3 className="text-base font-semibold mb-2 text-primary-text">
                {feature.title}
              </h3>
              <p className="text-secondary-text text-sm leading-relaxed">
                {feature.text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
