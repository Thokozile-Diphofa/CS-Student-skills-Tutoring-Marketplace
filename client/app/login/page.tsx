"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type LoginResponse = {
  error?: string;
  user?: {
    roles?: string[];
    email?: string;
    firstName?: string;
    lastName?: string;
  };
};

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

    let response: Response;

    try {
      response = await fetch(`${API_BASE_URL}/api/auth/login`, {
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

    } catch (err) {
      console.error("Login network error:", err);
      setErrorMessage(`Unable to connect to backend server at ${API_BASE_URL}. Please ensure the Express server is running ('npm start' in server folder).`);
      setLoading(false);
      return;
    }

    const data = await response.json().catch(() => null) as LoginResponse | null;

    if (!response.ok) {
      setErrorMessage(data?.error || "Login failed. Please check your credentials.");
      setLoading(false);
      return;
    }

    if (!data?.user) {
      setErrorMessage("The server returned an invalid login response. Please try again.");
      setLoading(false);
      return;
    }

    const rolesArray = Array.isArray(data.user.roles) ? data.user.roles : [];
    localStorage.setItem("user_roles", JSON.stringify(rolesArray));
    if (data.user.email) {
      localStorage.setItem("user_email", data.user.email);
    }
    localStorage.setItem("user_name", `${data.user.firstName || ""} ${data.user.lastName || ""}`.trim());

    const requestedPath = new URLSearchParams(window.location.search).get("next");
    const safeRequestedPath = requestedPath?.startsWith("/")
      && !requestedPath.startsWith("//")
      && !requestedPath.includes("\\")
      ? requestedPath
      : null;
    if (rolesArray.includes("ADMIN")) {
      router.push("/dashboard/admin");
    } else if (rolesArray.includes("TUTOR")) {
      router.push("/dashboard/tutor");
    } else if (safeRequestedPath) {
      router.push(safeRequestedPath);
    } else {
      router.push("/dashboard/student");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F3EEFF] to-[#FFF0E8] px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-[#CFC4F8] bg-white/70 shadow-lg backdrop-blur-sm">
        <div className="grid lg:min-h-[680px] lg:grid-cols-2">
          {/* LEFT SIDE: Vibrant purple gradient */}
          <div
            className="flex items-center justify-center px-5 py-9 text-white sm:px-10 sm:py-12"
            style={{ background: "linear-gradient(135deg, #6C4CF1 0%, #8B5CF6 100%)" }}
          >
            <div className="max-w-md">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFD166] text-lg font-black text-[#241B3B] shadow-sm">
                  E
                </div>
                <span className="text-2xl font-bold text-white tracking-tight">EasyLearning</span>
              </div>

              <h1 className="mt-8 text-3xl font-bold tracking-tight text-white sm:mt-10 sm:text-4xl">Welcome back</h1>
              <p className="mt-4 text-base text-[#EDE7FF]">
                Continue learning with student tutors who understand your course goals and academic journey.
              </p>

              <div className="mt-10 space-y-4">
                <div
                  className="rounded-2xl border border-white/20 p-4 shadow-sm"
                  style={{ background: "rgba(255, 255, 255, 0.12)" }}
                >
                  <p className="text-sm font-medium text-[#EDE7FF]">Popular subject support</p>
                  <p className="mt-2 text-lg font-semibold text-white">Computer Science & Mathematics</p>
                </div>
                <div
                  className="rounded-2xl border border-white/20 p-4 shadow-sm"
                  style={{ background: "rgba(255, 255, 255, 0.12)" }}
                >
                  <p className="text-sm font-medium text-[#EDE7FF]">Helpful tutors</p>
                  <p className="mt-2 text-lg font-semibold text-white">Verified student mentors</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Warm colourful gradient (soft peach -> lavender) */}
          <div
            className="flex items-center justify-center px-5 py-9 sm:px-10 sm:py-12"
            style={{ background: "linear-gradient(135deg, #FFE8DD 0%, #EDE7FF 100%)" }}
          >
            <div className="w-full max-w-md">
              <div className="mb-8">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#6C4CF1]">Login</p>
                <h2 className="mt-2 text-3xl font-bold text-[#241B3B]">Access your account</h2>
              </div>

              {errorMessage && (
                <div className="mb-6 break-words rounded-xl border border-[#EF4444] bg-[#EF4444]/10 p-4 text-sm font-medium text-[#EF4444]">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-[#241B3B]">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@university.ac.za"
                    style={{ background: "rgba(255, 255, 255, 0.55)" }}
                    className="w-full rounded-xl border border-[#CFC4F8] px-4 py-3 text-[#241B3B] placeholder-[#625B71] outline-none transition focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30 focus:bg-white"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-[#241B3B]">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      style={{ background: "rgba(255, 255, 255, 0.55)" }}
                      className="w-full rounded-xl border border-[#CFC4F8] px-4 py-3 pr-11 text-[#241B3B] placeholder-[#625B71] outline-none transition focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30 focus:bg-white"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute inset-y-0 right-3 flex items-center text-sm font-medium text-[#625B71] hover:text-[#241B3B]"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
                  <label className="flex items-center gap-2 text-[#625B71]">
                    <input type="checkbox" className="h-4 w-4 rounded border-[#CFC4F8] accent-[#6C4CF1] focus:ring-[#6C4CF1]" />
                    Remember me
                  </label>
                  <Link href="/login" className="font-semibold text-[#6C4CF1] hover:text-[#8B5CF6]">
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: loading ? "#8B5CF6" : "linear-gradient(90deg, #6C4CF1, #8B5CF6)",
                  }}
                  className="w-full rounded-xl px-4 py-3 font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-50"
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-[#625B71]">
                Don’t have an account?{" "}
                <Link href="/register" className="font-semibold text-[#6C4CF1] hover:text-[#8B5CF6]">
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
