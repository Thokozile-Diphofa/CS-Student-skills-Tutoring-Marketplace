"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  university: string;
  email: string;
  roles: string[];
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          method: "GET",
          credentials: "include"
        });

        if (!response.ok) {
          router.push("/login");
          return;
        }

        const data = await response.json();
        const roles: string[] = data.user?.roles || [];

        if (!roles.includes("STUDENT")) {
          if (roles.includes("TUTOR")) router.push("/dashboard/tutor");
          else if (roles.includes("ADMIN")) router.push("/dashboard/admin");
          else router.push("/login");
          return;
        }

        setUser(data.user);
      } catch (err) {
        console.error("Auth check failed:", err);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  const handleBecomeTutor = async () => {
    setUpgrading(true);
    setUpgradeMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/upgrade-tutor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include"
      });

      const data = await response.json();

      if (!response.ok) {
        setUpgradeMessage(data.error || "Failed to upgrade account.");
        setUpgrading(false);
        return;
      }

      setUpgradeMessage(data.message || "Account successfully upgraded to Tutor!");
      if (data.user) {
        setUser(data.user);
        localStorage.setItem("user_roles", JSON.stringify(data.user.roles));
      }
    } catch (err) {
      console.error("Upgrade error:", err);
      setUpgradeMessage("Network error during upgrade. Please check backend connection.");
    } finally {
      setUpgrading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
    } catch (err) {
      console.error("Logout request error:", err);
    } finally {
      localStorage.clear();
      router.push("/login");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        <p className="text-lg font-medium">Loading Student Dashboard...</p>
      </div>
    );
  }

  const isDualRole = user?.roles.includes("TUTOR");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-slate-950 text-white border-b border-slate-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-slate-950">
              E
            </div>
            <span className="text-xl font-bold tracking-tight">EasyLearning</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="rounded-full bg-amber-400/10 border border-amber-400/30 px-3 py-1 text-xs font-bold text-amber-400">
              {isDualRole ? "STUDENT & TUTOR" : "STUDENT ROLE"}
            </span>

            {isDualRole ? (
              <Link
                href="/dashboard/tutor"
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20"
              >
                Switch to Tutor Dashboard →
              </Link>
            ) : null}

            <button
              onClick={handleLogout}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 hover:border-slate-600"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {upgradeMessage && (
          <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-900 shadow-sm">
            {upgradeMessage}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Student Dashboard</h1>
              <p className="mt-1 text-slate-600">Welcome back, {user?.firstName} {user?.lastName}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-semibold text-slate-700">
              {user?.university}
            </span>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-600">Account Profile</h2>
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <p><strong className="text-slate-900">User ID:</strong> #{user?.id}</p>
                <p><strong className="text-slate-900">Name:</strong> {user?.firstName} {user?.lastName}</p>
                <p><strong className="text-slate-900">Email:</strong> {user?.email}</p>
                <p><strong className="text-slate-900">University:</strong> {user?.university}</p>
                <p><strong className="text-slate-900">Assigned Roles:</strong> {user?.roles.join(", ")}</p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-700">Peer Tutor Program</h2>
                <p className="mt-2 text-sm text-amber-900">
                  {isDualRole
                    ? "You are registered as both a Student and a Peer Tutor on EasyLearning! You can help other students and manage tutoring requests."
                    : "Strong in your Computer Science courses? Upgrade your account to become a Peer Tutor while keeping your existing student account."}
                </p>
              </div>

              <div className="mt-6">
                {!isDualRole ? (
                  <button
                    onClick={handleBecomeTutor}
                    disabled={upgrading}
                    className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-amber-300 disabled:opacity-50"
                  >
                    {upgrading ? "Upgrading to Tutor..." : "Become a Peer Tutor"}
                  </button>
                ) : (
                  <Link
                    href="/dashboard/tutor"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
                  >
                    Open Tutor Dashboard
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
