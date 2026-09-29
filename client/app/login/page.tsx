"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Login failed. Please check your credentials.");
        setLoading(false);
        return;
      }

      if (data.user) {
        const rolesArray = data.user.roles || [];
        localStorage.setItem("user_roles", JSON.stringify(rolesArray));
        localStorage.setItem("user_email", data.user.email);
        localStorage.setItem("user_name", `${data.user.firstName} ${data.user.lastName}`);
      }

      const roles: string[] = data.user?.roles || [];
      if (roles.includes("ADMIN")) {
        router.push("/dashboard/admin");
      } else if (roles.includes("TUTOR")) {
        router.push("/dashboard/tutor");
      } else {
        router.push("/dashboard/student");
      }
    } catch (err) {
      console.error("Login network error:", err);
      setErrorMessage(`Unable to connect to backend server at ${API_BASE_URL}. Please ensure the Express server is running ('npm start' in server folder).`);
      setLoading(false);
    }
  };

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

              {errorMessage && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@university.ac.za"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white"
                    disabled={loading}
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
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white"
                      disabled={loading}
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
                  disabled={loading}
                  className="w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-900 transition hover:bg-amber-300 disabled:opacity-50"
                >
                  {loading ? "Logging in..." : "Login"}
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
