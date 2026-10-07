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

interface IncomingSessionRequest {
  id: number;
  studentId: number;
  studentFirstName: string;
  studentLastName: string;
  subject: string;
  message: string | null;
  requestedDate: string | null;
  status: string;
  hourlyRate: string | null;
}

interface OverviewMetricProps {
  label: string;
  value: string | number;
  detail: string;
}

function OverviewMetric({ label, value, detail }: OverviewMetricProps) {
  return (
    <section className="rounded-xl border border-[#CFC4F8] bg-white/80 p-5 shadow-sm backdrop-blur-sm">
      <p className="text-sm font-medium text-[#625B71]">{label}</p>
      <p className="mt-3 text-2xl font-bold text-[#241B3B]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[#625B71]">{detail}</p>
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
  const [incomingRequests, setIncomingRequests] = useState<IncomingSessionRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState("");
  const [requestActionError, setRequestActionError] = useState("");
  const [requestActionMessage, setRequestActionMessage] = useState("");
  const [respondingToId, setRespondingToId] = useState<number | null>(null);

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

        if (roles.includes("ADMIN")) {
          router.replace("/dashboard/admin");
          return;
        }

        if (!roles.includes("TUTOR")) {
          if (roles.includes("STUDENT")) router.replace("/dashboard/student");
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

        try {
          const requestsResponse = await fetch(`${API_BASE_URL}/api/session-requests/incoming`, {
            credentials: "include"
          });
          if (!requestsResponse.ok) throw new Error("Incoming requests could not be loaded.");
          const requestsData = await requestsResponse.json();
          if (!cancelled) {
            setIncomingRequests(Array.isArray(requestsData.sessionRequests) ? requestsData.sessionRequests : []);
          }
        } catch (error) {
          console.error("Incoming session requests request failed:", error);
          if (!cancelled) setRequestsError("Incoming requests could not be loaded. Please try again later.");
        } finally {
          if (!cancelled) setRequestsLoading(false);
        }
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

  async function respondToRequest(requestId: number, status: "ACCEPTED" | "DECLINED") {
    setRequestActionError("");
    setRequestActionMessage("");
    setRespondingToId(requestId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/session-requests/${requestId}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update this request.");
      setIncomingRequests((current) => current.map((request) => request.id === requestId
        ? { ...request, status: data.sessionRequest.status }
        : request));
      setRequestActionMessage(status === "ACCEPTED" ? "Session request accepted." : "Session request declined.");
    } catch (error) {
      setRequestActionError(error instanceof Error ? error.message : "Unable to update this request.");
    } finally {
      setRespondingToId(null);
    }
  }

  function formatRequestedDate(value: string | null) {
    if (!value) return "No date requested";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Date unavailable"
      : new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F3EEFF] to-[#FFF0E8] px-6 text-center text-[#625B71]">
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
          <p className="text-sm font-semibold uppercase tracking-wider text-[#22C55E]">Tutor Dashboard</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#241B3B]">Welcome back, {user.firstName}</h1>
          <p className="mt-2 text-sm text-[#625B71]">Your tutoring profile and activity.</p>
        </div>
        <p className="text-sm font-medium text-[#625B71]">{user.university}</p>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <OverviewMetric
          label="Pending Requests"
          value={requestsLoading ? "Loading" : requestsError ? "Unavailable" : incomingRequests.filter((request) => request.status === "PENDING").length}
          detail={requestsError || "Requests awaiting your response."}
        />
        <OverviewMetric
          label="Accepted Requests"
          value={requestsLoading ? "Loading" : requestsError ? "Unavailable" : incomingRequests.filter((request) => request.status === "ACCEPTED").length}
          detail={requestsError || "Requests you have accepted."}
        />
        <OverviewMetric
          label="Subjects Offered"
          value={profileLoading ? "Loading" : profileError ? "Unavailable" : profile?.subjects.length ?? 0}
          detail="Subjects listed on your tutoring profile."
        />
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-3">
        <section id="profile" className="scroll-mt-6 rounded-xl border border-[#CFC4F8] bg-white/80 p-6 shadow-sm backdrop-blur-sm lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#CFC4F8]/50 pb-5">
            <div>
              <h2 className="text-lg font-bold text-[#241B3B]">My Tutoring Profile</h2>
              <p className="mt-1 text-sm text-[#625B71]">Profile details currently stored for your tutor account.</p>
            </div>
            {profile && <p className="rounded-md bg-[#EDE7FF] px-3 py-1.5 text-xs font-semibold text-[#6C4CF1]">{profile.university}</p>}
          </div>

          {profileLoading ? (
            <p className="py-6 text-sm text-[#625B71]" role="status">Loading your tutor profile...</p>
          ) : profileError ? (
            <p className="py-6 text-sm font-medium text-[#EF4444]" role="alert">{profileError}</p>
          ) : profile ? (
            <div className="pt-5">
              <h3 className="text-base font-semibold text-[#241B3B]">{profile.firstName} {profile.lastName}</h3>
              <p className="mt-1 break-all text-sm text-[#625B71]">{profile.email}</p>
              {profile.headline && <p className="mt-5 text-sm font-semibold text-[#241B3B]">{profile.headline}</p>}
              <div className="mt-5">
                <h3 className="text-xs font-bold uppercase text-[#625B71]">About</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#241B3B]">
                  {profile.bio || "No bio is listed on your tutor profile."}
                </p>
              </div>
              <div className="mt-5">
                <h3 className="text-xs font-bold uppercase text-[#625B71]">Subjects</h3>
                {profile.subjects.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {profile.subjects.map((subject) => (
                      <li key={subject} className="rounded-md border border-[#22C55E]/30 bg-[#22C55E]/10 px-2.5 py-1 text-xs font-medium text-[#22C55E]">
                        {subject}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-[#625B71]">No subjects are listed on your tutor profile.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="py-6 text-sm text-[#625B71]">Tutor profile information is not available.</p>
          )}
        </section>

        <section className="rounded-xl border border-[#CFC4F8] bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <h2 className="text-lg font-bold text-[#241B3B]">Rate</h2>
          {profileLoading ? (
            <p className="mt-4 text-sm text-[#625B71]" role="status">Loading rate...</p>
          ) : profileError ? (
            <p className="mt-4 text-sm text-[#625B71]">Rate unavailable.</p>
          ) : profile ? (
            <p className="mt-3 text-2xl font-bold text-[#6C4CF1]">R{profile.hourlyRate.toFixed(2)} <span className="text-sm font-medium text-[#625B71]">/ hour</span></p>
          ) : (
            <p className="mt-4 text-sm text-[#625B71]">Rate unavailable.</p>
          )}
          <p className="mt-4 border-t border-[#CFC4F8]/50 pt-4 text-xs leading-5 text-[#625B71]">
            This is the rate currently stored in your tutor profile.
          </p>
        </section>
      </div>

      <section id="requests" className="mt-7 scroll-mt-6 rounded-xl border border-[#CFC4F8] bg-white/80 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="text-lg font-bold text-[#241B3B]">Incoming Requests</h2>
        {requestActionMessage && <p className="mt-4 text-sm font-medium text-[#15803D]" role="status">{requestActionMessage}</p>}
        {requestActionError && <p className="mt-4 text-sm font-medium text-[#EF4444]" role="alert">{requestActionError}</p>}
        {requestsLoading ? (
          <p className="mt-4 text-sm text-[#625B71]" role="status">Loading incoming requests...</p>
        ) : requestsError ? (
          <p className="mt-4 text-sm font-medium text-[#EF4444]" role="alert">{requestsError}</p>
        ) : incomingRequests.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-[#625B71]">No students have requested a session yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[#CFC4F8]/60">
            {incomingRequests.map((request) => (
              <li key={request.id} className="grid gap-4 py-5 first:pt-0 last:pb-0 md:grid-cols-[1fr_auto] md:items-center">
                <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                  <div><p className="text-[#625B71]">Student</p><p className="mt-1 font-semibold text-[#241B3B]">{request.studentFirstName} {request.studentLastName}</p></div>
                  <div><p className="text-[#625B71]">Subject</p><p className="mt-1 font-semibold text-[#241B3B]">{request.subject}</p></div>
                  <div><p className="text-[#625B71]">Requested date</p><p className="mt-1 font-semibold text-[#241B3B]">{formatRequestedDate(request.requestedDate)}</p></div>
                  <div><p className="text-[#625B71]">Status</p><p className="mt-1 font-semibold text-[#241B3B]">{request.status}</p></div>
                  {request.message && <div className="sm:col-span-2 xl:col-span-3"><p className="text-[#625B71]">Message</p><p className="mt-1 whitespace-pre-line text-[#241B3B]">{request.message}</p></div>}
                </div>
                {request.status === "PENDING" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void respondToRequest(request.id, "ACCEPTED")}
                      disabled={respondingToId === request.id}
                      className="min-h-10 rounded-lg bg-[#22C55E] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#16A34A] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {respondingToId === request.id ? "Saving..." : "Accept"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void respondToRequest(request.id, "DECLINED")}
                      disabled={respondingToId === request.id}
                      className="min-h-10 rounded-lg border border-[#EF4444] px-4 py-2 text-sm font-semibold text-[#EF4444] transition hover:bg-[#EF4444]/5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardShell>
  );
}
