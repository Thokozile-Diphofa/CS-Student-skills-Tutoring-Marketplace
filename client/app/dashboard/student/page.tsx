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

interface SessionRequest {
  id: number;
  tutorId: number;
  tutorFirstName: string;
  tutorLastName: string;
  subject: string;
  requestedDate: string | null;
  status: string;
  hourlyRate: string | null;
  paymentStatus: string | null;
  payoutStatus: string | null;
  currency: string | null;
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

export default function StudentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [availableTutors, setAvailableTutors] = useState<number | null>(null);
  const [tutorCountError, setTutorCountError] = useState(false);
  const [sessionRequests, setSessionRequests] = useState<SessionRequest[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [payingSessionId, setPayingSessionId] = useState<number | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    university: "",
    email: ""
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState("");
  const [profileSaveError, setProfileSaveError] = useState("");

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      firstName: user.firstName,
      lastName: user.lastName,
      university: user.university,
      email: user.email
    });
  }, [user]);

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

        if (roles.includes("ADMIN")) {
          router.replace("/dashboard/admin");
          return;
        }

        if (!roles.includes("STUDENT")) {
          if (roles.includes("TUTOR")) router.replace("/dashboard/tutor");
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

        try {
          const sessionResponse = await fetch(`${API_BASE_URL}/api/session-requests/mine`, {
            credentials: "include"
          });
          if (!sessionResponse.ok) throw new Error("Session requests could not be loaded.");
          const sessionData = await sessionResponse.json();
          if (!cancelled) {
            setSessionRequests(Array.isArray(sessionData.sessionRequests) ? sessionData.sessionRequests : []);
          }
        } catch (error) {
          console.error("Session requests request failed:", error);
          if (!cancelled) setSessionsError("Your session requests could not be loaded.");
        } finally {
          if (!cancelled) setSessionsLoading(false);
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

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileSaveError("");
    setProfileSaveMessage("");
    setProfileSaving(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(profileForm)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Your profile could not be updated.");

      setUser(data.user);
      setProfileForm({
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        university: data.user.university,
        email: data.user.email
      });
      setProfileSaveMessage("Profile updated successfully.");
      setIsEditingProfile(false);
    } catch (error) {
      setProfileSaveError(error instanceof Error ? error.message : "Your profile could not be updated.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function payForSession(sessionRequestId: number) {
    setPaymentError("");
    setPayingSessionId(sessionRequestId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/payments/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionRequestId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Payment could not be initialized.");
      if (typeof data.paymentUrl !== "string" || !data.fields || typeof data.fields !== "object") {
        throw new Error("The payment service returned invalid checkout details.");
      }

      const checkoutForm = document.createElement("form");
      checkoutForm.method = "POST";
      checkoutForm.action = data.paymentUrl;
      for (const [name, value] of Object.entries(data.fields)) {
        if (typeof value !== "string") continue;
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        checkoutForm.appendChild(input);
      }
      document.body.appendChild(checkoutForm);
      checkoutForm.submit();
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Payment could not be initialized.");
      setPayingSessionId(null);
    }
  }

  function formatSessionFee(value: string | null) {
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? `R${amount.toFixed(2)}` : "Unavailable";
  }

  function formatRequestedDate(value: string | null) {
    if (!value) return "Not scheduled";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Date unavailable"
      : new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F3EEFF] to-[#FFF0E8] px-6 text-center text-[#625B71]">
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
          <p className="text-sm font-semibold uppercase tracking-wider text-[#6C4CF1]">Student Dashboard</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#241B3B]">Welcome back, {user.firstName}</h1>
          <p className="mt-2 text-sm text-[#625B71]">Your learning activity and student profile.</p>
        </div>
        <p className="text-sm font-medium text-[#625B71]">{user.university}</p>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <OverviewMetric
          label="Available Tutors"
          value={tutorCountError ? "Unavailable" : availableTutors ?? "Loading"}
          detail={tutorCountError ? "Tutor listings could not be loaded." : "Tutors currently listed in EasyLearning."}
        />
        <OverviewMetric
          label="Pending Requests"
          value={sessionsLoading ? "Loading" : sessionsError ? "Unavailable" : sessionRequests.filter((request) => request.status === "PENDING").length}
          detail={sessionsError || "Requests awaiting a tutor response."}
        />
        <OverviewMetric
          label="Accepted Sessions"
          value={sessionsLoading ? "Loading" : sessionsError ? "Unavailable" : sessionRequests.filter((request) => request.status === "ACCEPTED").length}
          detail={sessionsError || "Requests accepted by tutors."}
        />
      </div>

      <section className="mt-7 flex flex-col gap-5 rounded-xl border border-[#CFC4F8] bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#241B3B]">Find your next tutor</h2>
          <p className="mt-1 text-sm text-[#625B71]">Search tutor profiles and filter by subject using the live tutor directory.</p>
        </div>
        <Link
          href="/tutors"
          style={{ background: "linear-gradient(90deg, #6C4CF1, #8B5CF6)" }}
          className="inline-flex min-h-10 items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
        >
          Find Tutors
        </Link>
      </section>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <section id="profile" className="scroll-mt-6 rounded-xl border border-[#CFC4F8] bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-[#241B3B]">Profile</h2>
            {!isEditingProfile && (
              <button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                className="rounded-lg border border-[#CFC4F8] bg-[#F3EEFF] px-3 py-2 text-xs font-semibold text-[#6C4CF1] transition hover:bg-[#EDE7FF]"
              >
                Edit profile
              </button>
            )}
          </div>

          {profileSaveMessage && <p className="mt-4 text-sm font-medium text-[#15803D]" role="status">{profileSaveMessage}</p>}
          {profileSaveError && <p className="mt-4 text-sm font-medium text-[#EF4444]" role="alert">{profileSaveError}</p>}

          {isEditingProfile ? (
            <form onSubmit={saveProfile} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-[#625B71]">
                  <span className="mb-1.5 block font-medium text-[#241B3B]">First name</span>
                  <input
                    type="text"
                    value={profileForm.firstName}
                    onChange={(event) => setProfileForm((current) => ({ ...current, firstName: event.target.value }))}
                    className="w-full rounded-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm text-[#241B3B] outline-none transition focus:border-[#6C4CF1]"
                    required
                  />
                </label>
                <label className="text-sm text-[#625B71]">
                  <span className="mb-1.5 block font-medium text-[#241B3B]">Last name</span>
                  <input
                    type="text"
                    value={profileForm.lastName}
                    onChange={(event) => setProfileForm((current) => ({ ...current, lastName: event.target.value }))}
                    className="w-full rounded-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm text-[#241B3B] outline-none transition focus:border-[#6C4CF1]"
                    required
                  />
                </label>
              </div>

              <label className="block text-sm text-[#625B71]">
                <span className="mb-1.5 block font-medium text-[#241B3B]">University</span>
                <select
                  value={profileForm.university}
                  onChange={(event) => setProfileForm((current) => ({ ...current, university: event.target.value }))}
                  className="w-full rounded-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm text-[#241B3B] outline-none transition focus:border-[#6C4CF1]"
                  required
                >
                  <option value="">Select your university</option>
                  <option value="UCT">UCT</option>
                  <option value="Wits">Wits</option>
                  <option value="UP">UP</option>
                  <option value="UJ">UJ</option>
                  <option value="TUT">TUT</option>
                  <option value="UKZN">UKZN</option>
                  <option value="NWU">NWU</option>
                  <option value="UP">UP</option>
                  <option value="UNISA">UNISA</option>
                  <option value="UWC">UWC</option>
                  <option value="DUT">DUT</option>
                  <option value="CPUT">CPUT</option>
                  <option value="CUT">CUT</option>
                  <option value="MUT">MUT</option>
                  <option value="NMU">NMU</option>
                  <option value="RU">RU</option>
                  <option value="SMU">SMU</option>
                  <option value="SPU">SPU</option>
                  <option value="SU">SU</option>
                  <option value="UFH">UFH</option>
                  <option value="UL">UL</option>
                  <option value="UMP">UMP</option>
                  <option value="UNIVEN">UNIVEN</option>
                  <option value="UNIZULU">UNIZULU</option>
                  <option value="VUT">VUT</option>
                  <option value="WSU">WSU</option>
                </select>
              </label>

              <label className="block text-sm text-[#625B71]">
                <span className="mb-1.5 block font-medium text-[#241B3B]">Email</span>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm text-[#241B3B] outline-none transition focus:border-[#6C4CF1]"
                  required
                />
              </label>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#6C4CF1] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#5B3FD2] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {profileSaving ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileForm({
                      firstName: user?.firstName || "",
                      lastName: user?.lastName || "",
                      university: user?.university || "",
                      email: user?.email || ""
                    });
                    setProfileSaveError("");
                    setProfileSaveMessage("");
                    setIsEditingProfile(false);
                  }}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#CFC4F8] bg-white px-4 py-2 text-sm font-semibold text-[#241B3B] transition hover:bg-[#F3EEFF]"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-[#625B71]">Name</dt><dd className="mt-1 font-medium text-[#241B3B]">{user.firstName} {user.lastName}</dd></div>
              <div><dt className="text-[#625B71]">Email</dt><dd className="mt-1 break-all font-medium text-[#241B3B]">{user.email}</dd></div>
              <div><dt className="text-[#625B71]">University</dt><dd className="mt-1 font-medium text-[#241B3B]">{user.university}</dd></div>
              <div><dt className="text-[#625B71]">Roles</dt><dd className="mt-1 font-medium text-[#241B3B]">{user.roles.join(", ")}</dd></div>
            </dl>
          )}
        </section>

        <section id="requests" className="scroll-mt-6 rounded-xl border border-[#CFC4F8] bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <h2 className="text-lg font-bold text-[#241B3B]">My Session Requests</h2>
          {paymentError && <p className="mt-4 text-sm font-medium text-[#EF4444]" role="alert">{paymentError}</p>}
          {sessionsLoading ? (
            <p className="mt-4 text-sm text-[#625B71]" role="status">Loading your session requests...</p>
          ) : sessionsError ? (
            <p className="mt-4 text-sm font-medium text-[#EF4444]" role="alert">{sessionsError}</p>
          ) : sessionRequests.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-[#625B71]">You have no session requests yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[#CFC4F8]/60">
              {sessionRequests.map((request) => {
                const paid = request.paymentStatus === "PAID";
                const acceptedAndUnpaid = request.status === "ACCEPTED" && !paid;
                return (
                  <li key={request.id} className="grid gap-4 py-5 first:pt-0 last:pb-0 md:grid-cols-[1fr_auto] md:items-center">
                    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                      <div><dt className="text-[#625B71]">Tutor</dt><dd className="mt-1 font-semibold text-[#241B3B]">{request.tutorFirstName} {request.tutorLastName}</dd></div>
                      <div><dt className="text-[#625B71]">Subject</dt><dd className="mt-1 font-semibold text-[#241B3B]">{request.subject}</dd></div>
                      <div><dt className="text-[#625B71]">Requested date</dt><dd className="mt-1 font-semibold text-[#241B3B]">{formatRequestedDate(request.requestedDate)}</dd></div>
                      <div><dt className="text-[#625B71]">Status</dt><dd className="mt-1 font-semibold text-[#241B3B]">{request.status}</dd></div>
                      <div><dt className="text-[#625B71]">Session fee</dt><dd className="mt-1 font-semibold text-[#241B3B]">{formatSessionFee(request.hourlyRate)}</dd></div>
                      <div><dt className="text-[#625B71]">Payment</dt><dd className="mt-1 font-semibold text-[#241B3B]">{paid ? "Paid" : request.paymentStatus || "Unpaid"}</dd></div>
                    </dl>
                    {acceptedAndUnpaid && (
                      <button
                        type="button"
                        onClick={() => void payForSession(request.id)}
                        disabled={payingSessionId === request.id}
                        style={{ background: "linear-gradient(90deg, #6C4CF1, #8B5CF6)" }}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {payingSessionId === request.id ? "Preparing payment..." : "Pay for Session"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
