"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const ADMIN_ACCESS_MESSAGE = "Admin access is restricted to administrator accounts.";

interface AuthResponse {
  error?: string;
  user?: {
    roles?: string[];
    email?: string;
    firstName?: string;
    lastName?: string;
  };
}

function clearClientMetadata() {
  ["user_roles", "user_email", "user_name"].forEach((key) => localStorage.removeItem(key));
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" });
        if (response.status === 401) return;
        if (!response.ok) throw new Error("Unable to verify this account. Please try again.");

        const data = await response.json();
        const roles: string[] = Array.isArray(data.user?.roles) ? data.user.roles : [];
        if (cancelled) return;

        if (roles.includes("ADMIN")) {
          router.replace("/dashboard/admin");
        } else if (roles.includes("STUDENT") || roles.includes("TUTOR")) {
          setErrorMessage(ADMIN_ACCESS_MESSAGE);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to verify this account. Please try again.");
        }
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    void checkExistingSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await response.json().catch(() => null) as AuthResponse | null;

      if (!response.ok || !data?.user) {
        setErrorMessage(data?.error || "Login failed. Please check your credentials.");
        return;
      }

      const roles = Array.isArray(data.user.roles) ? data.user.roles : [];
      if (!roles.includes("ADMIN")) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: "POST",
          credentials: "include"
        }).catch(() => null);
        clearClientMetadata();
        setErrorMessage(ADMIN_ACCESS_MESSAGE);
        return;
      }

      localStorage.setItem("user_roles", JSON.stringify(roles));
      if (data.user.email) localStorage.setItem("user_email", data.user.email);
      localStorage.setItem("user_name", `${data.user.firstName || ""} ${data.user.lastName || ""}`.trim());
      router.replace("/dashboard/admin");
    }  catch (error) {
  console.error("Admin login error:", error);
  setErrorMessage(
    error instanceof Error
      ? error.message
      : `Unable to connect to backend server at ${API_BASE_URL}. Please try again.`
  );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F3EEFF] to-[#FFF0E8] px-4 py-10 text-[#241B3B]">
      <section className="w-full max-w-md overflow-hidden rounded-2xl border border-[#CFC4F8] bg-white/90 shadow-lg">
        <div className="bg-[#241B3B] px-7 py-6 text-white sm:px-9">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FFD166] text-lg font-black text-[#241B3B]">E</span>
            <span className="text-xl font-bold">EasyLearning</span>
          </Link>
          <p className="mt-6 text-sm font-semibold uppercase text-[#FFD166]">Administrator access</p>
          <h1 className="mt-1 text-3xl font-bold">Admin Login</h1>
        </div>

        <div className="px-7 py-7 sm:px-9">
          {errorMessage && (
            <p className="mb-5 rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 p-3 text-sm font-medium text-[#B91C1C]" role="alert">
              {errorMessage}
            </p>
          )}

          {checkingSession ? (
            <p className="py-5 text-center text-sm text-[#625B71]" role="status">Checking account access...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
              <label className="block text-sm font-medium text-[#241B3B]">
                <span className="mb-2 block">Email</span>
                <input
                  type="email"
                  name="admin-login-email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  disabled={loading}
                  className="w-full rounded-lg border border-[#CFC4F8] bg-white px-3 py-3 outline-none focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/20 disabled:opacity-60"
                />
              </label>

              <label className="block text-sm font-medium text-[#241B3B]">
                <span className="mb-2 block">Password</span>
                <input
                  type="password"
                  name="admin-login-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  disabled={loading}
                  className="w-full rounded-lg border border-[#CFC4F8] bg-white px-3 py-3 outline-none focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/20 disabled:opacity-60"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#6C4CF1] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#5B3FD2] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Verifying..." : "Sign in as Admin"}
              </button>
            </form>
          )}

          <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-[#6C4CF1] hover:underline">
            Student / Tutor login
          </Link>
        </div>
      </section>
    </main>
  );
}
