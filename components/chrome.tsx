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
    <header className="border-b border-gray-900 bg-black/90 backdrop-blur sticky top-0 z-40">
      <nav
        aria-label="Main navigation"
        className="flex items-center justify-between px-6 sm:px-8 py-4 max-w-7xl mx-auto"
      >
        <Link href="/" className="text-2xl font-bold shrink-0">
          Interview<span className="text-blue-500">Pressure</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`font-medium transition hover:text-blue-400 ${
                pathname === link.href ? "text-blue-500" : "text-gray-300"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {status === "authenticated" && user && (
            <button
              type="button"
              onClick={() => void signOut()}
              className="border border-gray-700 hover:bg-gray-900 px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Log out
            </button>
          )}
        </div>

        <button
          type="button"
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="md:hidden border border-gray-700 rounded-lg px-3 py-2 text-sm font-semibold"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </nav>

      {menuOpen && (
        <div className="md:hidden border-t border-gray-900 px-6 py-4 space-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`block rounded-lg px-3 py-2 font-medium transition ${
                pathname === link.href
                  ? "text-blue-500 bg-blue-500/10"
                  : "text-gray-300 hover:bg-gray-900"
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
              className="block w-full text-left rounded-lg px-3 py-2 font-medium text-gray-300 hover:bg-gray-900 transition"
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
    <footer className="border-t border-gray-900 mt-auto">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-10 grid gap-8 sm:grid-cols-3">
        <div>
          <p className="text-xl font-bold">
            Interview<span className="text-blue-500">Pressure</span>
          </p>
          <p className="text-gray-500 text-sm mt-3 max-w-xs">
            Practice real interview pressure with your resume, your voice and
            local AI feedback. Your data never leaves your machine.
          </p>
        </div>

        <div>
          <p className="text-gray-400 text-sm font-semibold uppercase tracking-wide">
            Product
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/upload" className="text-gray-500 hover:text-blue-400 transition">
                Start an interview
              </Link>
            </li>
            <li>
              <Link href="/history" className="text-gray-500 hover:text-blue-400 transition">
                Interview history
              </Link>
            </li>
            <li>
              <Link href="/profile" className="text-gray-500 hover:text-blue-400 transition">
                Profile
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-gray-400 text-sm font-semibold uppercase tracking-wide">
            Local &amp; private
          </p>
          <p className="text-gray-500 text-sm mt-3">
            Speech-to-text and answer evaluation run fully on your computer
            with Whisper and Ollama. No paid AI APIs, no API keys.
          </p>
        </div>
      </div>

      <div className="border-t border-gray-900 py-5 text-center text-gray-600 text-sm">
        Interview Pressure Simulator © 2026
      </div>
    </footer>
  );
}
