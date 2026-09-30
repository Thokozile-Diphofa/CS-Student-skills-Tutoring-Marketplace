"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardShell from "../../components/DashboardShell";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  university: string;
  email: string;
  roles: string[];
}

interface OverviewMetricProps {
  label: string;
  value: string | number;
  detail: string;
}

function OverviewMetric({ label, value, detail }: OverviewMetricProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </section>
  );
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [availableTutors, setAvailableTutors] = useState<number | null>(null);
  const [tutorCountError, setTutorCountError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const authResponse = await fetch(`${API_BASE_URL}/api/auth/me`, {
          method: "GET",
          credentials: "include"
        });

        if (authResponse.status === 401) {
          router.replace("/login");
          return;
        }
        if (!authResponse.ok) throw new Error("Unable to verify your account.");

        const authData = await authResponse.json();
        const authenticatedUser: UserProfile | null = authData.user || null;
        const roles = authenticatedUser?.roles || [];

        if (!roles.includes("STUDENT")) {
          if (roles.includes("TUTOR")) router.replace("/dashboard/tutor");
          else if (roles.includes("ADMIN")) router.replace("/dashboard/admin");
          else router.replace("/login");
          return;
        }

        if (cancelled || !authenticatedUser) return;
        setUser(authenticatedUser);

        try {
          const tutorResponse = await fetch(`${API_BASE_URL}/api/tutors`, {
            credentials: "include"
          });
          if (!tutorResponse.ok) throw new Error("Tutor count unavailable.");
          const tutorData = await tutorResponse.json();
          if (!cancelled) {
            setAvailableTutors(Array.isArray(tutorData.tutors) ? tutorData.tutors.length : 0);
          }
        } catch (error) {
          console.error("Tutor count request failed:", error);
          if (!cancelled) setTutorCountError(true);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        if (!cancelled) setAuthError("We could not verify your account. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center text-slate-600">
        <p className="text-sm font-medium" role={authError ? "alert" : "status"}>
          {authError || "Verifying your student account..."}
        </p>
      </div>
    );
  }

  return (
    <DashboardShell role="STUDENT" activeItem="Dashboard" user={user}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-700">Student Dashboard</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Welcome back, {user.firstName}</h1>
          <p className="mt-2 text-sm text-slate-600">Your learning activity and student profile.</p>
        </div>
        <p className="text-sm font-medium text-slate-500">{user.university}</p>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <OverviewMetric
          label="Available Tutors"
          value={tutorCountError ? "Unavailable" : availableTutors ?? "Loading"}
          detail={tutorCountError ? "Tutor listings could not be loaded." : "Tutors currently listed in EasyLearning."}
        />
        <OverviewMetric
          label="Pending Requests"
          value="Not available"
          detail="The session-request feature has not been implemented."
        />
        <OverviewMetric
          label="Accepted Sessions"
          value="Not available"
          detail="Session booking data is not available yet."
        />
      </div>

      <section className="mt-7 flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Find your next tutor</h2>
          <p className="mt-1 text-sm text-slate-600">Search tutor profiles and filter by subject using the live tutor directory.</p>
        </div>
        <Link
          href="/tutors"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
        >
          Find Tutors
        </Link>
      </section>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <section id="profile" className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">Profile</h2>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Name</dt><dd className="mt-1 font-medium text-slate-900">{user.firstName} {user.lastName}</dd></div>
            <div><dt className="text-slate-500">Email</dt><dd className="mt-1 break-all font-medium text-slate-900">{user.email}</dd></div>
            <div><dt className="text-slate-500">University</dt><dd className="mt-1 font-medium text-slate-900">{user.university}</dd></div>
            <div><dt className="text-slate-500">Roles</dt><dd className="mt-1 font-medium text-slate-900">{user.roles.join(", ")}</dd></div>
          </dl>
        </section>

        <section id="requests" className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">My Requests</h2>
          <div className="mt-4 border-l-2 border-amber-400 pl-4">
            <p className="text-sm font-semibold text-slate-800">Tutoring requests are not available yet.</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">There is no request API to check for existing requests or statuses.</p>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
