"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

const AUTH_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/history", label: "History" },
  { href: "/profile", label: "Profile" },
];

export function NavBar() {
  const pathname = usePathname();
  const { status, user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const links =
    status === "authenticated"
      ? AUTH_LINKS
      : [
          { href: "/login", label: "Login" },
          { href: "/signup", label: "Sign Up" },
        ];

  return (
    <header className="border-b border-border-s bg-base/80 backdrop-blur-xl sticky top-0 z-40">
      <nav
        aria-label="Main navigation"
        className="flex items-center justify-between px-6 sm:px-8 py-4 max-w-7xl mx-auto"
      >
        <Link href="/" className="text-xl font-bold tracking-tight shrink-0">
          Interview<span className="text-accent">Pressure</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                pathname === link.href
                  ? "text-accent bg-accent/10"
                  : "text-secondary-text hover:text-primary-text hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {status === "authenticated" && user && (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-border-s">
              <span className="text-xs text-muted-text hidden lg:block">
                {user.name.split(" ")[0]}
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="border border-border-d hover:border-danger/50 hover:text-danger hover:bg-danger/5 px-4 py-2 rounded-lg text-sm font-medium text-secondary-text transition-all duration-200"
              >
                Log out
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="md:hidden border border-border-d rounded-lg px-3 py-2 text-sm font-medium text-secondary-text hover:text-primary-text hover:border-border-d/80 transition-all duration-200"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </nav>

      {menuOpen && (
        <div className="md:hidden border-t border-border-s bg-base/95 backdrop-blur-xl px-6 py-4 space-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`block rounded-lg px-4 py-2.5 font-medium transition-all duration-200 ${
                pathname === link.href
                  ? "text-accent bg-accent/10"
                  : "text-secondary-text hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {status === "authenticated" && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                void signOut();
              }}
              className="block w-full text-left rounded-lg px-4 py-2.5 font-medium text-secondary-text hover:text-danger hover:bg-danger/5 transition-all duration-200"
            >
              Log out
            </button>
          )}
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border-s mt-auto bg-base/50">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-12 grid gap-8 sm:grid-cols-3">
        <div>
          <p className="text-lg font-bold tracking-tight">
            Interview<span className="text-accent">Pressure</span>
          </p>
          <p className="text-muted-text text-sm mt-3 max-w-xs leading-relaxed">
            Practice real interview pressure with your resume, your voice and
            local AI feedback. Your data never leaves your machine.
          </p>
        </div>

        <div>
          <p className="text-secondary-text text-xs font-semibold uppercase tracking-widest">
            Product
          </p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link
                href="/upload"
                className="text-muted-text hover:text-accent transition-colors duration-200"
              >
                Start an interview
              </Link>
            </li>
            <li>
              <Link
                href="/history"
                className="text-muted-text hover:text-accent transition-colors duration-200"
              >
                Interview history
              </Link>
            </li>
            <li>
              <Link
                href="/profile"
                className="text-muted-text hover:text-accent transition-colors duration-200"
              >
                Profile
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-secondary-text text-xs font-semibold uppercase tracking-widest">
            Local &amp; private
          </p>
          <p className="text-muted-text text-sm mt-4 leading-relaxed">
            Speech-to-text and answer evaluation run fully on your computer
            with Whisper and Ollama. No paid AI APIs, no API keys.
          </p>
        </div>
      </div>

      <div className="border-t border-border-s py-6 text-center text-muted-text text-xs">
        Interview Pressure Simulator &copy; 2026
      </div>
    </footer>
  );
}
