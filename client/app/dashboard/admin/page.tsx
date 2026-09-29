"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  university: string;
  email: string;
  roles: string[];
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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

        if (!roles.includes("ADMIN")) {
          if (roles.includes("STUDENT")) router.push("/dashboard/student");
          else if (roles.includes("TUTOR")) router.push("/dashboard/tutor");
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
        <p className="text-lg font-medium">Loading Admin Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-slate-950 text-white border-b border-slate-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500 text-lg font-black text-white">
              A
            </div>
            <span className="text-xl font-bold tracking-tight">EasyLearning Admin</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="rounded-full bg-red-500/10 border border-red-500/30 px-3 py-1 text-xs font-bold text-red-400">
              ADMIN ROLE
            </span>
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
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
              <p className="mt-1 text-slate-600">Welcome back, {user?.firstName} {user?.lastName}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-semibold text-slate-700">
              System Administrator
            </span>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-red-600">Admin Account Info</h2>
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <p><strong className="text-slate-900">User ID:</strong> #{user?.id}</p>
                <p><strong className="text-slate-900">Name:</strong> {user?.firstName} {user?.lastName}</p>
                <p><strong className="text-slate-900">Email:</strong> {user?.email}</p>
                <p><strong className="text-slate-900">Assigned Roles:</strong> {user?.roles.join(", ")}</p>
              </div>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50/50 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-red-700">System Isolation</h2>
              <p className="mt-2 text-sm text-red-900">
                Admin role is strictly isolated. Cannot be acquired via public registration or student upgrade.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
