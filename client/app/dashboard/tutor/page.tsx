"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

interface TutorProfile {
  id: number;
  firstName: string;
  lastName: string;
  university: string;
  email: string;
  headline: string | null;
  bio: string | null;
  hourlyRate: number;
  subjects: string[];
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

export default function TutorDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profile, setProfile] = useState<TutorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      let authenticated = false;
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

        if (!roles.includes("TUTOR")) {
          if (roles.includes("STUDENT")) router.replace("/dashboard/student");
          else if (roles.includes("ADMIN")) router.replace("/dashboard/admin");
          else router.replace("/login");
          return;
        }

        if (cancelled || !authenticatedUser) return;
        authenticated = true;
        setUser(authenticatedUser);

        const profileResponse = await fetch(`${API_BASE_URL}/api/tutors/profile`, {
          credentials: "include"
        });
        if (!profileResponse.ok) throw new Error("Tutor profile could not be loaded.");
        const profileData = await profileResponse.json();
        if (!cancelled) setProfile(profileData.tutor || null);
      } catch (error) {
        console.error("Tutor dashboard request failed:", error);
        if (!cancelled) {
          if (authenticated) setProfileError("Your tutor profile could not be loaded. Please try again later.");
          else setAuthError("We could not verify your account. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setProfileLoading(false);
        }
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
          {authError || "Verifying your tutor account..."}
        </p>
      </div>
    );
  }

  return (
    <DashboardShell role="TUTOR" activeItem="Dashboard" user={user}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Tutor Dashboard</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Welcome back, {user.firstName}</h1>
          <p className="mt-2 text-sm text-slate-600">Your tutoring profile and activity.</p>
        </div>
        <p className="text-sm font-medium text-slate-500">{user.university}</p>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <OverviewMetric
          label="Pending Requests"
          value="Not available"
          detail="The session-request feature has not been implemented."
        />
        <OverviewMetric
          label="Accepted Requests"
          value="Not available"
          detail="Request statuses are not available yet."
        />
        <OverviewMetric
          label="Subjects Offered"
          value={profileLoading ? "Loading" : profileError ? "Unavailable" : profile?.subjects.length ?? 0}
          detail="Subjects listed on your tutoring profile."
        />
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-3">
        <section id="profile" className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-950">My Tutoring Profile</h2>
              <p className="mt-1 text-sm text-slate-600">Profile details currently stored for your tutor account.</p>
            </div>
            {profile && <p className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{profile.university}</p>}
          </div>

          {profileLoading ? (
            <p className="py-6 text-sm text-slate-500" role="status">Loading your tutor profile...</p>
          ) : profileError ? (
            <p className="py-6 text-sm text-red-700" role="alert">{profileError}</p>
          ) : profile ? (
            <div className="pt-5">
              <h3 className="text-base font-semibold text-slate-900">{profile.firstName} {profile.lastName}</h3>
              <p className="mt-1 break-all text-sm text-slate-600">{profile.email}</p>
              {profile.headline && <p className="mt-5 text-sm font-semibold text-slate-800">{profile.headline}</p>}
              <div className="mt-5">
                <h3 className="text-xs font-bold uppercase text-slate-500">About</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                  {profile.bio || "No bio is listed on your tutor profile."}
                </p>
              </div>
              <div className="mt-5">
                <h3 className="text-xs font-bold uppercase text-slate-500">Subjects</h3>
                {profile.subjects.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {profile.subjects.map((subject) => (
                      <li key={subject} className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                        {subject}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No subjects are listed on your tutor profile.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="py-6 text-sm text-slate-600">Tutor profile information is not available.</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">Rate</h2>
          {profileLoading ? (
            <p className="mt-4 text-sm text-slate-500" role="status">Loading rate...</p>
          ) : profileError ? (
            <p className="mt-4 text-sm text-slate-600">Rate unavailable.</p>
          ) : profile ? (
            <p className="mt-3 text-2xl font-bold text-amber-700">R{profile.hourlyRate.toFixed(2)} <span className="text-sm font-medium text-slate-500">/ hour</span></p>
          ) : (
            <p className="mt-4 text-sm text-slate-600">Rate unavailable.</p>
          )}
          <p className="mt-4 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
            This is the rate currently stored in your tutor profile.
          </p>
        </section>
      </div>

      <section id="requests" className="mt-7 scroll-mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-950">Incoming Requests</h2>
        <div className="mt-4 border-l-2 border-emerald-500 pl-4">
          <p className="text-sm font-semibold text-slate-800">Requests students send to you will appear here.</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">Request tracking and accept/decline actions are not available yet.</p>
        </div>
      </section>
    </DashboardShell>
  );
}
