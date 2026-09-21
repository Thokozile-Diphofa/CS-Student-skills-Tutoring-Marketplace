"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="grid min-h-[760px] lg:grid-cols-2">
          <div className="flex items-center justify-center bg-slate-950 px-6 py-12 text-white md:px-10">
            <div className="max-w-md">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-slate-950">
                  E
                </div>
                <span className="text-2xl font-bold">EasyLearning</span>
              </div>

              <h1 className="mt-10 text-4xl font-bold tracking-tight">Welcome back</h1>
              <p className="mt-4 text-base text-slate-300">
                Continue learning with student tutors who understand your course goals and academic journey.
              </p>

              <div className="mt-10 space-y-4">
                <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-300">Popular subject support</p>
                  <p className="mt-2 text-lg font-semibold text-white">Computer Science & Mathematics</p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-300">Helpful tutors</p>
                  <p className="mt-2 text-lg font-semibold text-white">Verified student mentors</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center bg-white px-6 py-10 md:px-10">
            <div className="w-full max-w-md">
              <div className="mb-8">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">Login</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">Access your account</h2>
              </div>

              <form className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="student@university.ac.za"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
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

                <div className="flex items-center justify-between gap-4 text-sm">
                  <label className="flex items-center gap-2 text-slate-600">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400" />
                    Remember me
                  </label>
                  <Link href="/login" className="font-medium text-amber-600 hover:text-amber-500">
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-900 transition hover:bg-amber-300"
                >
                  Login
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-600">
                Don’t have an account?{" "}
                <Link href="/register" className="font-semibold text-amber-600 hover:text-amber-500">
                  Register
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
