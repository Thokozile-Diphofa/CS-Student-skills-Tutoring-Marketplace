"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const universityDomains: Record<string, string[]> = {
  tut: ["tut4life.ac.za", "tut.ac.za"],
  tshwane: ["tut4life.ac.za", "tut.ac.za"],
  wits: ["wits.ac.za"],
  uct: ["uct.ac.za"],
  stellenbosch: ["sun.ac.za"],
  sun: ["sun.ac.za"],
  up: ["up.ac.za"],
  pretoria: ["up.ac.za"],
};

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getAllowedDomains(university: string) {
  const normalized = normalizeText(university);

  if (!normalized) {
    return [];
  }

  for (const [key, domains] of Object.entries(universityDomains)) {
    if (normalized.includes(key)) {
      return domains;
    }
  }

  return [];
}

function validateUniversityEmail(email: string, university: string) {
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    return "Email is required.";
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(trimmedEmail)) {
    return "Please enter a valid email address.";
  }

  const domain = trimmedEmail.split("@")[1]?.toLowerCase();
  if (!domain) {
    return "Email must include a university domain.";
  }

  const allowedDomains = getAllowedDomains(university);

  if (allowedDomains.length === 0) {
    return domain.endsWith(".ac.za")
      ? ""
      : "Please use your university email address.";
  }

  if (!allowedDomains.includes(domain)) {
    const example = `studentNumber@${allowedDomains[0]}`;
    return `Use your university email, for example ${example}.`;
  }

  return "";
}

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [university, setUniversity] = useState("");
  const [email, setEmail] = useState("");

  const emailError = useMemo(() => validateUniversityEmail(email, university), [email, university]);
  const universityDomainHint = useMemo(() => {
    const domains = getAllowedDomains(university);
    return domains.length > 0 ? `Example: studentNumber@${domains[0]}` : "Use a university email ending in .ac.za";
  }, [university]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="grid min-h-[840px] lg:grid-cols-2">
          <div className="flex items-center justify-center bg-slate-950 px-6 py-12 text-white md:px-10">
            <div className="max-w-md">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-slate-950">
                  E
                </div>
                <span className="text-2xl font-bold">EasyLearning</span>
              </div>

              <h1 className="mt-10 text-4xl font-bold tracking-tight">Create your account</h1>
              <p className="mt-4 text-base text-slate-300">
                Join a supportive community of students learning, teaching, and growing together.
              </p>

              <div className="mt-10 rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
                <p className="text-sm text-slate-300">You can join as</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-800 p-3">
                    <p className="font-semibold text-white">Student</p>
                    <p className="mt-1 text-xs text-slate-300">Find tutors and book support.</p>
                  </div>
                  <div className="rounded-xl bg-slate-800 p-3">
                    <p className="font-semibold text-white">Tutor</p>
                    <p className="mt-1 text-xs text-slate-300">Share your skills and help others.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center bg-white px-6 py-10 md:px-10">
            <div className="w-full max-w-md">
              <div className="mb-8">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">Register</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">Join EasyLearning</h2>
              </div>

              <form className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-slate-700">
                      First Name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      placeholder="First Name"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="lastName" className="mb-2 block text-sm font-medium text-slate-700">
                      Last Name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      placeholder="Last Name"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="university" className="mb-2 block text-sm font-medium text-slate-700">
                    University
                  </label>
                  <input
                    id="university"
                    type="text"
                    value={university}
                    onChange={(event) => setUniversity(event.target.value)}
                    placeholder="TUT, UCT, Wits, UP..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="studentNumber@tut4life.ac.za"
                    className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:bg-white ${
                      emailError ? "border-red-300 bg-red-50 focus:border-red-400" : "border-slate-200 bg-slate-50 focus:border-amber-400"
                    }`}
                  />
                  <p className="mt-2 text-xs text-slate-500">{universityDomainHint}</p>
                  {emailError ? <p className="mt-2 text-xs text-red-600">{emailError}</p> : null}
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute inset-y-0 right-3 flex items-center text-sm font-medium text-slate-500 hover:text-slate-700"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-700">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className="absolute inset-y-0 right-3 flex items-center text-sm font-medium text-slate-500 hover:text-slate-700"
                    >
                      {showConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Role</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
                      <input type="radio" name="role" defaultChecked className="h-4 w-4 accent-amber-500" />
                      Student
                    </label>
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
                      <input type="radio" name="role" className="h-4 w-4 accent-amber-500" />
                      Tutor
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-900 transition hover:bg-amber-300"
                >
                  Create Account
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-600">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-amber-600 hover:text-amber-500">
                  Login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
