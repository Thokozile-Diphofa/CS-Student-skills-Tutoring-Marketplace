"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "../../components/DashboardShell";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";
type ApplicationFilter = "ALL" | ApplicationStatus;

interface AdminUser {
  id: number;
  firstName: string;
  lastName: string;
  university: string;
  email: string;
  roles: string[];
  createdAt: string | null;
}

interface TutorApplication {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  institution: string;
  programme: string | null;
  yearOfStudy: number | null;
  subjects: string[];
  experience: string | null;
  motivation: string | null;
  proposedHourlyRate: number | null;
  status: ApplicationStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

interface ApprovedTutor {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  university: string;
  hourlyRate: number | null;
  approvalStatus: ApplicationStatus;
  subjects: string[];
}

interface PaymentRecord {
  id: number;
  amount: number | null;
  currency: string | null;
  paymentStatus: string | null;
  payoutStatus: string | null;
  provider: string | null;
  reference: string | null;
  providerReference: string | null;
  createdAt: string | null;
  paidAt: string | null;
  receiptNumber: string | null;
  sessionRequestId: number | null;
  subject: string | null;
  requestedDate: string | null;
  sessionStatus: string | null;
  studentName: string | null;
  tutorName: string | null;
}

interface AdminDashboardData {
  overview: {
    totalUsers: number;
    students: number;
    approvedTutors: number;
    pendingApplications: number;
  };
  users: AdminUser[];
  approvedTutors: ApprovedTutor[];
  payments: PaymentRecord[];
}

interface AdminSessionUser {
  firstName: string;
  lastName: string;
  roles: string[];
}

async function readError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : fallback;
}

async function fetchDashboardData(): Promise<{ dashboard: AdminDashboardData; applications: TutorApplication[] }> {
  const [dashboardResponse, applicationsResponse] = await Promise.all([
    fetch(`${API_BASE_URL}/api/admin/dashboard`, { credentials: "include" }),
    fetch(`${API_BASE_URL}/api/tutor-applications`, { credentials: "include" })
  ]);

  if (!dashboardResponse.ok) {
    throw new Error(await readError(dashboardResponse, "Unable to load admin dashboard data."));
  }
  if (!applicationsResponse.ok) {
    throw new Error(await readError(applicationsResponse, "Unable to load tutor applications."));
  }

  const [dashboard, applicationData] = await Promise.all([
    dashboardResponse.json() as Promise<AdminDashboardData>,
    applicationsResponse.json() as Promise<{ applications: TutorApplication[] }>
  ]);

  return {
    dashboard: {
      ...dashboard,
      payments: Array.isArray(dashboard.payments) ? dashboard.payments : []
    },
    applications: applicationData.applications || []
  };
}

function formatDate(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(date);
}

function formatRate(value: number | null) {
  return value === null ? "Not set" : new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(value);
}

function formatAmount(value: number | null, currency: string | null = "ZAR") {
  if (value === null || Number.isNaN(value)) return "Not set";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: currency || "ZAR"
  }).format(value);
}

function paymentStatusClass(status: string | null) {
  if (status === "PAID") return "border-[#22C55E]/40 bg-[#22C55E]/10 text-[#22C55E]";
  if (status === "PENDING") return "border-[#FF8A4C]/40 bg-[#FF8A4C]/10 text-[#FF8A4C]";
  if (status === "FAILED" || status === "DECLINED") return "border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]";
  return "border-[#625B71]/20 bg-[#F3EEFF] text-[#625B71]";
}

function statusClass(status: ApplicationStatus) {
  if (status === "PENDING") return "border-[#FF8A4C]/40 bg-[#FF8A4C]/10 text-[#FF8A4C]";
  if (status === "APPROVED") return "border-[#22C55E]/40 bg-[#22C55E]/10 text-[#22C55E]";
  return "border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]";
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminSessionUser | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [applications, setApplications] = useState<TutorApplication[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null);
  const [filter, setFilter] = useState<ApplicationFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAdminDashboard() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" });
        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        if (!response.ok) throw new Error("Unable to verify your administrator access.");

        const data = await response.json();
        const roles: string[] = Array.isArray(data.user?.roles) ? data.user.roles : [];
        if (!roles.includes("ADMIN")) {
          if (roles.includes("TUTOR")) router.replace("/dashboard/tutor");
          else if (roles.includes("STUDENT")) router.replace("/dashboard/student");
          else router.replace("/login");
          return;
        }

        const loaded = await fetchDashboardData();
        if (cancelled) return;
        setAdmin({
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          roles
        });
        setDashboard(loaded.dashboard);
        setApplications(loaded.applications);
        setSelectedApplicationId(loaded.applications[0]?.id ?? null);
      } catch (error) {
        if (!cancelled) setPageError(error instanceof Error ? error.message : "Unable to load admin dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAdminDashboard();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function refreshDashboard() {
    setPageError("");
    try {
      const loaded = await fetchDashboardData();
      setDashboard(loaded.dashboard);
      setApplications(loaded.applications);
      setSelectedApplicationId((current) => loaded.applications.some((application) => application.id === current)
        ? current
        : loaded.applications[0]?.id ?? null);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to refresh admin dashboard.");
    }
  }

  async function reviewApplication(status: "APPROVED" | "REJECTED") {
    const selectedApplication = applications.find((application) => application.id === selectedApplicationId);
    if (!selectedApplication) return;
    if (status === "REJECTED" && !rejectionReason.trim()) {
      setReviewError("Enter a short reason before rejecting this application.");
      return;
    }

    setReviewingId(selectedApplication.id);
    setReviewError("");
    setNotice("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/tutor-applications/${selectedApplication.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(status === "REJECTED"
          ? { status, rejectionReason: rejectionReason.trim() }
          : { status })
      });
      if (!response.ok) {
        setReviewError(await readError(response, "The application could not be reviewed."));
        return;
      }

      setNotice(status === "APPROVED" ? "Application approved. Tutor access is now available." : "Application rejected.");
      setShowRejectionForm(false);
      setRejectionReason("");
      await refreshDashboard();
    } catch {
      setReviewError("We could not reach the server. The application was not updated.");
    } finally {
      setReviewingId(null);
    }
  }

  const filteredApplications = applications.filter((application) => filter === "ALL" || application.status === filter);
  const selectedApplication = applications.find((application) => application.id === selectedApplicationId) || null;
  const applicationCounts: Record<ApplicationFilter, number> = {
    ALL: applications.length,
    PENDING: applications.filter((application) => application.status === "PENDING").length,
    APPROVED: applications.filter((application) => application.status === "APPROVED").length,
    REJECTED: applications.filter((application) => application.status === "REJECTED").length
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F3EEFF] to-[#FFF0E8] text-[#625B71]" role="status">
        <p className="text-sm font-medium">Loading admin dashboard...</p>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F3EEFF] to-[#FFF0E8] px-5 text-[#625B71]" role="status">
        <p>{pageError || "Redirecting to an authorized page..."}</p>
      </div>
    );
  }

  return (
    <DashboardShell role="ADMIN" activeItem="Dashboard" user={admin}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#CFC4F8] pb-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[#6C4CF1]">Administration</p>
            <h1 className="mt-1 text-3xl font-bold text-[#241B3B]">Admin Dashboard</h1>
            <p className="mt-2 text-sm text-[#625B71]">Welcome, {admin.firstName} {admin.lastName}</p>
          </div>
          <p className="text-sm text-[#625B71]">Signed in as <span className="font-semibold text-[#241B3B]">{admin.roles.join(", ")}</span></p>
        </div>

        {pageError && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-l-4 border-[#EF4444] bg-[#EF4444]/10 p-4 text-sm text-[#EF4444]" role="alert">
            <p>{pageError}</p>
            <button type="button" onClick={() => void refreshDashboard()} className="font-semibold underline">Retry</button>
          </div>
        )}

        {dashboard && (
          <>
            <section aria-labelledby="overview-heading" className="py-7">
              <h2 id="overview-heading" className="text-lg font-bold text-[#241B3B]">Overview</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: "Total Users", value: dashboard.overview.totalUsers, tone: "border-[#6C4CF1]" },
                  { label: "Students", value: dashboard.overview.students, tone: "border-[#8B5CF6]" },
                  { label: "Approved Tutors", value: dashboard.overview.approvedTutors, tone: "border-[#22C55E]" },
                  { label: "Pending Applications", value: dashboard.overview.pendingApplications, tone: "border-[#FF8A4C]" }
                ].map((item) => (
                  <div key={item.label} className={`border-l-4 ${item.tone} rounded-r-xl bg-white/80 px-4 py-4 shadow-sm backdrop-blur-sm`}>
                    <p className="text-sm text-[#625B71]">{item.label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-[#241B3B]">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="applications-heading" className="border-t border-[#CFC4F8] py-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 id="applications-heading" className="text-xl font-bold text-[#241B3B]">Tutor Applications</h2>
                  <p className="mt-1 text-sm text-[#625B71]">Review submitted applications and decide tutor access.</p>
                </div>
                <div className="flex max-w-full flex-wrap gap-1" role="tablist" aria-label="Filter tutor applications">
                  {(["ALL", "PENDING", "APPROVED", "REJECTED"] as ApplicationFilter[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      role="tab"
                      aria-selected={filter === status}
                      onClick={() => setFilter(status)}
                      className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition ${filter === status ? "border-[#6C4CF1] text-[#6C4CF1]" : "border-transparent text-[#625B71] hover:text-[#241B3B]"}`}
                    >
                      {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
                      <span className="ml-1 text-xs tabular-nums">{applicationCounts[status]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 divide-y divide-[#CFC4F8] border-y border-[#CFC4F8] sm:hidden">
                {filteredApplications.map((application) => (
                  <article key={application.id} className={`px-3 py-4 ${application.status === "PENDING" ? "bg-[#EDE7FF]/50" : "bg-white/80"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#241B3B]">{application.firstName} {application.lastName}</p>
                        <p className="mt-0.5 break-all text-xs text-[#625B71]">{application.email}</p>
                      </div>
                      <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass(application.status)}`}>{application.status}</span>
                    </div>
                    <p className="mt-2 break-words text-sm text-[#241B3B]">{application.institution}</p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#625B71]">
                      <span>{formatDate(application.submittedAt)}</span>
                      <button type="button" onClick={() => { setSelectedApplicationId(application.id); setShowRejectionForm(false); setReviewError(""); }} className="font-semibold text-[#6C4CF1] underline underline-offset-2">View</button>
                    </div>
                  </article>
                ))}
                {filteredApplications.length === 0 && <p className="px-4 py-8 text-center text-sm text-[#625B71]">No {filter === "ALL" ? "submitted" : filter.toLowerCase()} applications.</p>}
              </div>

              <div className="mt-5 hidden overflow-x-auto rounded-xl border border-[#CFC4F8] bg-white/80 shadow-sm backdrop-blur-sm sm:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-[#EDE7FF]/60 text-xs uppercase text-[#625B71]">
                    <tr>
                      <th scope="col" className="px-4 py-3">Applicant</th>
                      <th scope="col" className="px-4 py-3">Institution</th>
                      <th scope="col" className="px-4 py-3">Submitted</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                      <th scope="col" className="px-4 py-3"><span className="sr-only">View</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#CFC4F8]">
                    {filteredApplications.map((application) => (
                      <tr key={application.id} className={application.status === "PENDING" ? "bg-[#EDE7FF]/30" : ""}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#241B3B]">{application.firstName} {application.lastName}</p>
                          <p className="mt-0.5 text-xs text-[#625B71]">{application.email}</p>
                        </td>
                        <td className="px-4 py-3 text-[#241B3B]">{application.institution}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#625B71]">{formatDate(application.submittedAt)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass(application.status)}`}>
                            {application.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => { setSelectedApplicationId(application.id); setShowRejectionForm(false); setReviewError(""); }} className="font-semibold text-[#6C4CF1] underline underline-offset-2">
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredApplications.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-[#625B71]">No {filter === "ALL" ? "submitted" : filter.toLowerCase()} applications.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {selectedApplication && (
                <div className="mt-6 rounded-xl border-l-4 border-[#6C4CF1] border-y border-r border-[#CFC4F8] bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#CFC4F8]/50 pb-4">
                    <div>
                      <p className="text-xs font-bold uppercase text-[#6C4CF1]">Tutor Application</p>
                      <h3 className="mt-1 text-xl font-bold text-[#241B3B]">{selectedApplication.firstName} {selectedApplication.lastName}</h3>
                      <a className="mt-1 inline-block break-all text-sm text-[#6C4CF1] underline" href={`mailto:${selectedApplication.email}`}>{selectedApplication.email}</a>
                    </div>
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass(selectedApplication.status)}`}>
                      {selectedApplication.status}
                    </span>
                  </div>

                  <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div><dt className="text-xs font-semibold uppercase text-[#625B71]">Institution</dt><dd className="mt-1 text-sm text-[#241B3B]">{selectedApplication.institution || "Not provided"}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase text-[#625B71]">Programme / course</dt><dd className="mt-1 text-sm text-[#241B3B]">{selectedApplication.programme || "Not provided"}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase text-[#625B71]">Year of study</dt><dd className="mt-1 text-sm text-[#241B3B]">{selectedApplication.yearOfStudy ?? "Not provided"}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase text-[#625B71]">Subjects / modules</dt><dd className="mt-1 text-sm text-[#241B3B]">{selectedApplication.subjects?.join(", ") || "Not provided"}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase text-[#625B71]">Proposed hourly rate</dt><dd className="mt-1 text-sm text-[#241B3B]">{formatRate(selectedApplication.proposedHourlyRate)}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase text-[#625B71]">Application date</dt><dd className="mt-1 text-sm text-[#241B3B]">{formatDate(selectedApplication.submittedAt)}</dd></div>
                    <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs font-semibold uppercase text-[#625B71]">Motivation</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#241B3B]">{selectedApplication.motivation || "Not provided"}</dd></div>
                    <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs font-semibold uppercase text-[#625B71]">Tutoring experience</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#241B3B]">{selectedApplication.experience || "Not provided"}</dd></div>
                    {selectedApplication.rejectionReason && <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs font-semibold uppercase text-[#625B71]">Rejection reason</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#241B3B]">{selectedApplication.rejectionReason}</dd></div>}
                  </dl>

                  {selectedApplication.status === "PENDING" && (
                    <div className="mt-6 border-t border-[#CFC4F8]/50 pt-5">
                      {reviewError && <p className="mb-4 text-sm font-medium text-[#EF4444]" role="alert">{reviewError}</p>}
                      {showRejectionForm ? (
                        <div className="max-w-2xl">
                          <label htmlFor="rejection-reason" className="block text-sm font-semibold text-[#241B3B]">Reason for rejection</label>
                          <textarea id="rejection-reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={3000} rows={3} className="mt-2 w-full rounded-xl border border-[#CFC4F8] bg-white p-3 text-sm outline-none focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30" />
                          <div className="mt-3 flex flex-wrap gap-3">
                            <button type="button" onClick={() => void reviewApplication("REJECTED")} disabled={reviewingId !== null} className="rounded-lg bg-[#EF4444] px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60">{reviewingId ? "Saving..." : "Confirm rejection"}</button>
                            <button type="button" onClick={() => { setShowRejectionForm(false); setReviewError(""); }} disabled={reviewingId !== null} className="px-4 py-2 text-sm font-semibold text-[#625B71] underline">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-3">
                          <button type="button" onClick={() => void reviewApplication("APPROVED")} disabled={reviewingId !== null} className="rounded-lg bg-[#22C55E] px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60">{reviewingId === selectedApplication.id ? "Saving..." : "Approve Application"}</button>
                          <button type="button" onClick={() => { setShowRejectionForm(true); setReviewError(""); }} disabled={reviewingId !== null} className="rounded-lg border border-[#EF4444] px-4 py-2 text-sm font-semibold text-[#EF4444] transition hover:bg-[#EF4444]/10 disabled:opacity-60">Reject Application</button>
                        </div>
                      )}
                    </div>
                  )}
                  {notice && <p className="mt-4 text-sm font-semibold text-[#22C55E]" role="status">{notice}</p>}
                </div>
              )}
            </section>

            <section aria-labelledby="payments-heading" className="border-t border-[#CFC4F8] py-7">
              <h2 id="payments-heading" className="text-xl font-bold text-[#241B3B]">Payments</h2>
              <div className="mt-4 divide-y divide-[#CFC4F8] border-y border-[#CFC4F8] sm:hidden">
                {dashboard.payments.length === 0 && <p className="px-4 py-8 text-center text-sm text-[#625B71]">No payment records yet.</p>}
                {dashboard.payments.map((payment) => (
                  <article key={payment.id} className="space-y-2 px-3 py-4 bg-white/80">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#241B3B]">{payment.studentName} → {payment.tutorName}</p>
                        <p className="text-xs text-[#625B71]">{payment.subject || "Session"} · {payment.receiptNumber || `Payment #${payment.id}`}</p>
                      </div>
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${paymentStatusClass(payment.paymentStatus)}`}>{payment.paymentStatus || "UNKNOWN"}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#241B3B]">
                      <span>{formatAmount(payment.amount, payment.currency)}</span>
                      <span className="text-[#625B71]">{payment.provider || "Provider"}</span>
                    </div>
                    <div className="text-xs text-[#625B71]">
                      <p>Reference: {payment.reference || "Not available"}</p>
                      <p>Session status: {payment.sessionStatus || "Unknown"}</p>
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-4 hidden overflow-x-auto rounded-xl border border-[#CFC4F8] bg-white/80 shadow-sm backdrop-blur-sm sm:block">
                <table className="w-full min-w-[940px] text-left text-sm">
                  <thead className="bg-[#EDE7FF]/60 text-xs uppercase text-[#625B71]">
                    <tr>
                      <th scope="col" className="px-4 py-3">Student</th>
                      <th scope="col" className="px-4 py-3">Tutor</th>
                      <th scope="col" className="px-4 py-3">Session</th>
                      <th scope="col" className="px-4 py-3">Amount</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                      <th scope="col" className="px-4 py-3">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#CFC4F8]">
                    {dashboard.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-4 py-3 font-semibold text-[#241B3B]">{payment.studentName || "Unknown"}</td>
                        <td className="px-4 py-3 text-[#241B3B]">{payment.tutorName || "Unknown"}</td>
                        <td className="px-4 py-3 text-[#241B3B]">
                          <p>{payment.subject || "Session"}</p>
                          <p className="mt-1 text-xs text-[#625B71]">{payment.sessionStatus || "Unknown"}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#241B3B]">{formatAmount(payment.amount, payment.currency)}</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${paymentStatusClass(payment.paymentStatus)}`}>{payment.paymentStatus || "UNKNOWN"}</span></td>
                        <td className="px-4 py-3 text-[#625B71]">{payment.reference || "Not available"}</td>
                      </tr>
                    ))}
                    {dashboard.payments.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#625B71]">No payment records yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="users-heading" className="border-t border-[#CFC4F8] py-7">
              <h2 id="users-heading" className="text-xl font-bold text-[#241B3B]">Users</h2>
              <div className="mt-4 divide-y divide-[#CFC4F8] border-y border-[#CFC4F8] sm:hidden">
                {dashboard.users.map((account) => (
                  <article key={account.id} className="space-y-1 px-3 py-4 bg-white/80">
                    <p className="font-semibold text-[#241B3B]">{account.firstName} {account.lastName}</p>
                    <p className="break-all text-sm text-[#625B71]">{account.email}</p>
                    <p className="break-words text-xs text-[#625B71]">{account.roles.join(", ") || "No role"} · Joined {formatDate(account.createdAt)}</p>
                  </article>
                ))}
                {dashboard.users.length === 0 && <p className="px-4 py-8 text-center text-sm text-[#625B71]">No users found.</p>}
              </div>
              <div className="mt-4 hidden overflow-x-auto rounded-xl border border-[#CFC4F8] bg-white/80 shadow-sm backdrop-blur-sm sm:block">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-[#EDE7FF]/60 text-xs uppercase text-[#625B71]">
                    <tr><th scope="col" className="px-4 py-3">Name</th><th scope="col" className="px-4 py-3">Email</th><th scope="col" className="px-4 py-3">Role / access</th><th scope="col" className="px-4 py-3">Joined</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#CFC4F8]">
                    {dashboard.users.map((account) => (
                      <tr key={account.id}>
                        <td className="px-4 py-3 font-semibold text-[#241B3B]">{account.firstName} {account.lastName}</td>
                        <td className="px-4 py-3 text-[#241B3B]">{account.email}</td>
                        <td className="px-4 py-3 text-[#625B71]">{account.roles.join(", ") || "No role"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#625B71]">{formatDate(account.createdAt)}</td>
                      </tr>
                    ))}
                    {dashboard.users.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-[#625B71]">No users found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="tutors-heading" className="border-t border-[#CFC4F8] py-7">
              <h2 id="tutors-heading" className="text-xl font-bold text-[#241B3B]">Approved Tutors</h2>
              <div className="mt-4 divide-y divide-[#CFC4F8] border-y border-[#CFC4F8] sm:hidden">
                {dashboard.approvedTutors.map((tutor) => (
                  <article key={tutor.id} className="space-y-1 px-3 py-4 bg-white/80">
                    <p className="font-semibold text-[#241B3B]">{tutor.firstName} {tutor.lastName}</p>
                    <p className="break-all text-sm text-[#625B71]">{tutor.email}</p>
                    <p className="break-words text-sm text-[#241B3B]">{tutor.subjects.join(", ") || "No subjects listed"}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-[#625B71]">
                      <span>{formatRate(tutor.hourlyRate)}</span>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${statusClass(tutor.approvalStatus)}`}>{tutor.approvalStatus}</span>
                    </div>
                  </article>
                ))}
                {dashboard.approvedTutors.length === 0 && <p className="px-4 py-8 text-center text-sm text-[#625B71]">No approved tutors yet.</p>}
              </div>
              <div className="mt-4 hidden overflow-x-auto rounded-xl border border-[#CFC4F8] bg-white/80 shadow-sm backdrop-blur-sm sm:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-[#EDE7FF]/60 text-xs uppercase text-[#625B71]">
                    <tr><th scope="col" className="px-4 py-3">Tutor</th><th scope="col" className="px-4 py-3">Subjects / modules</th><th scope="col" className="px-4 py-3">Hourly rate</th><th scope="col" className="px-4 py-3">Approval</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#CFC4F8]">
                    {dashboard.approvedTutors.map((tutor) => (
                      <tr key={tutor.id}>
                        <td className="px-4 py-3"><p className="font-semibold text-[#241B3B]">{tutor.firstName} {tutor.lastName}</p><p className="mt-0.5 text-xs text-[#625B71]">{tutor.email}</p></td>
                        <td className="px-4 py-3 text-[#241B3B]">{tutor.subjects.join(", ") || "No subjects listed"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#241B3B]">{formatRate(tutor.hourlyRate)}</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(tutor.approvalStatus)}`}>{tutor.approvalStatus}</span></td>
                      </tr>
                    ))}
                    {dashboard.approvedTutors.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-[#625B71]">No approved tutors yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
