"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";

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

interface AdminDashboardData {
  overview: {
    totalUsers: number;
    students: number;
    approvedTutors: number;
    pendingApplications: number;
  };
  users: AdminUser[];
  approvedTutors: ApprovedTutor[];
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
  return { dashboard, applications: applicationData.applications || [] };
}

function formatDate(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(date);
}

function formatRate(value: number | null) {
  return value === null ? "Not set" : new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(value);
}

function statusClass(status: ApplicationStatus) {
  if (status === "PENDING") return "border-amber-300 bg-amber-50 text-amber-900";
  if (status === "APPROVED") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  return "border-slate-300 bg-slate-100 text-slate-700";
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
          router.replace("/login?next=%2Fdashboard%2Fadmin");
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600" role="status">
        <p className="text-sm font-medium">Loading admin dashboard...</p>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 text-slate-600" role="status">
        <p>{pageError || "Redirecting to an authorized page..."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-slate-50 text-slate-900">
      <Navbar />
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm font-semibold uppercase text-red-700">Administration</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">Admin Dashboard</h1>
            <p className="mt-2 text-sm text-slate-600">Welcome, {admin.firstName} {admin.lastName}</p>
          </div>
          <p className="text-sm text-slate-600">Signed in as <span className="font-semibold text-slate-900">{admin.roles.join(", ")}</span></p>
        </div>

        {pageError && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-l-4 border-red-500 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <p>{pageError}</p>
            <button type="button" onClick={() => void refreshDashboard()} className="font-semibold underline">Retry</button>
          </div>
        )}

        {dashboard && (
          <>
            <section aria-labelledby="overview-heading" className="py-7">
              <h2 id="overview-heading" className="text-lg font-bold text-slate-950">Overview</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: "Total Users", value: dashboard.overview.totalUsers, tone: "border-slate-300" },
                  { label: "Students", value: dashboard.overview.students, tone: "border-sky-300" },
                  { label: "Approved Tutors", value: dashboard.overview.approvedTutors, tone: "border-emerald-300" },
                  { label: "Pending Applications", value: dashboard.overview.pendingApplications, tone: "border-amber-400" }
                ].map((item) => (
                  <div key={item.label} className={`border-l-4 ${item.tone} bg-white px-4 py-4 shadow-sm`}>
                    <p className="text-sm text-slate-600">{item.label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="applications-heading" className="border-t border-slate-200 py-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 id="applications-heading" className="text-xl font-bold text-slate-950">Tutor Applications</h2>
                  <p className="mt-1 text-sm text-slate-600">Review submitted applications and decide tutor access.</p>
                </div>
                <div className="flex max-w-full flex-wrap gap-1" role="tablist" aria-label="Filter tutor applications">
                  {(["ALL", "PENDING", "APPROVED", "REJECTED"] as ApplicationFilter[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      role="tab"
                      aria-selected={filter === status}
                      onClick={() => setFilter(status)}
                      className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${filter === status ? "border-amber-500 text-slate-950" : "border-transparent text-slate-500 hover:text-slate-900"}`}
                    >
                      {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
                      <span className="ml-1 text-xs tabular-nums">{applicationCounts[status]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200 sm:hidden">
                {filteredApplications.map((application) => (
                  <article key={application.id} className={`px-3 py-4 ${application.status === "PENDING" ? "bg-amber-50/50" : "bg-white"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-950">{application.firstName} {application.lastName}</p>
                        <p className="mt-0.5 break-all text-xs text-slate-600">{application.email}</p>
                      </div>
                      <span className={`inline-flex shrink-0 border px-2 py-1 text-xs font-semibold ${statusClass(application.status)}`}>{application.status}</span>
                    </div>
                    <p className="mt-2 break-words text-sm text-slate-700">{application.institution}</p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-600">
                      <span>{formatDate(application.submittedAt)}</span>
                      <button type="button" onClick={() => { setSelectedApplicationId(application.id); setShowRejectionForm(false); setReviewError(""); }} className="font-semibold text-amber-800 underline underline-offset-2">View</button>
                    </div>
                  </article>
                ))}
                {filteredApplications.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-600">No {filter === "ALL" ? "submitted" : filter.toLowerCase()} applications.</p>}
              </div>

              <div className="mt-5 hidden overflow-x-auto border-y border-slate-200 sm:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                    <tr>
                      <th scope="col" className="px-4 py-3">Applicant</th>
                      <th scope="col" className="px-4 py-3">Institution</th>
                      <th scope="col" className="px-4 py-3">Submitted</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                      <th scope="col" className="px-4 py-3"><span className="sr-only">View</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredApplications.map((application) => (
                      <tr key={application.id} className={application.status === "PENDING" ? "bg-amber-50/50" : ""}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-950">{application.firstName} {application.lastName}</p>
                          <p className="mt-0.5 text-xs text-slate-600">{application.email}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{application.institution}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(application.submittedAt)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex border px-2 py-1 text-xs font-semibold ${statusClass(application.status)}`}>
                            {application.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => { setSelectedApplicationId(application.id); setShowRejectionForm(false); setReviewError(""); }} className="font-semibold text-amber-800 underline underline-offset-2">
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredApplications.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-600">No {filter === "ALL" ? "submitted" : filter.toLowerCase()} applications.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {selectedApplication && (
                <div className="mt-6 border-l-4 border-amber-400 bg-white p-5 sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <p className="text-xs font-bold uppercase text-amber-800">Tutor Application</p>
                      <h3 className="mt-1 text-xl font-bold text-slate-950">{selectedApplication.firstName} {selectedApplication.lastName}</h3>
                      <a className="mt-1 inline-block break-all text-sm text-slate-700 underline" href={`mailto:${selectedApplication.email}`}>{selectedApplication.email}</a>
                    </div>
                    <span className={`inline-flex border px-2 py-1 text-xs font-semibold ${statusClass(selectedApplication.status)}`}>
                      {selectedApplication.status}
                    </span>
                  </div>

                  <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div><dt className="text-xs font-semibold uppercase text-slate-500">Institution</dt><dd className="mt-1 text-sm text-slate-900">{selectedApplication.institution || "Not provided"}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase text-slate-500">Programme / course</dt><dd className="mt-1 text-sm text-slate-900">{selectedApplication.programme || "Not provided"}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase text-slate-500">Year of study</dt><dd className="mt-1 text-sm text-slate-900">{selectedApplication.yearOfStudy ?? "Not provided"}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase text-slate-500">Subjects / modules</dt><dd className="mt-1 text-sm text-slate-900">{selectedApplication.subjects?.join(", ") || "Not provided"}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase text-slate-500">Proposed hourly rate</dt><dd className="mt-1 text-sm text-slate-900">{formatRate(selectedApplication.proposedHourlyRate)}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase text-slate-500">Application date</dt><dd className="mt-1 text-sm text-slate-900">{formatDate(selectedApplication.submittedAt)}</dd></div>
                    <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs font-semibold uppercase text-slate-500">Motivation</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selectedApplication.motivation || "Not provided"}</dd></div>
                    <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs font-semibold uppercase text-slate-500">Tutoring experience</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selectedApplication.experience || "Not provided"}</dd></div>
                    {selectedApplication.rejectionReason && <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs font-semibold uppercase text-slate-500">Rejection reason</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selectedApplication.rejectionReason}</dd></div>}
                  </dl>

                  {selectedApplication.status === "PENDING" && (
                    <div className="mt-6 border-t border-slate-200 pt-5">
                      {reviewError && <p className="mb-4 text-sm text-red-700" role="alert">{reviewError}</p>}
                      {showRejectionForm ? (
                        <div className="max-w-2xl">
                          <label htmlFor="rejection-reason" className="block text-sm font-semibold text-slate-800">Reason for rejection</label>
                          <textarea id="rejection-reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={3000} rows={3} className="mt-2 w-full border border-slate-300 bg-white p-3 text-sm outline-none focus:border-amber-500" />
                          <div className="mt-3 flex flex-wrap gap-3">
                            <button type="button" onClick={() => void reviewApplication("REJECTED")} disabled={reviewingId !== null} className="bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60">{reviewingId ? "Saving..." : "Confirm rejection"}</button>
                            <button type="button" onClick={() => { setShowRejectionForm(false); setReviewError(""); }} disabled={reviewingId !== null} className="px-4 py-2 text-sm font-semibold text-slate-700 underline">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-3">
                          <button type="button" onClick={() => void reviewApplication("APPROVED")} disabled={reviewingId !== null} className="bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{reviewingId === selectedApplication.id ? "Saving..." : "Approve Application"}</button>
                          <button type="button" onClick={() => { setShowRejectionForm(true); setReviewError(""); }} disabled={reviewingId !== null} className="border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60">Reject Application</button>
                        </div>
                      )}
                    </div>
                  )}
                  {notice && <p className="mt-4 text-sm font-medium text-emerald-800" role="status">{notice}</p>}
                </div>
              )}
            </section>

            <section aria-labelledby="users-heading" className="border-t border-slate-200 py-7">
              <h2 id="users-heading" className="text-xl font-bold text-slate-950">Users</h2>
              <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200 sm:hidden">
                {dashboard.users.map((account) => (
                  <article key={account.id} className="space-y-1 px-3 py-4">
                    <p className="font-semibold text-slate-950">{account.firstName} {account.lastName}</p>
                    <p className="break-all text-sm text-slate-700">{account.email}</p>
                    <p className="break-words text-xs text-slate-600">{account.roles.join(", ") || "No role"} · Joined {formatDate(account.createdAt)}</p>
                  </article>
                ))}
                {dashboard.users.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-600">No users found.</p>}
              </div>
              <div className="mt-4 hidden overflow-x-auto border-y border-slate-200 sm:block">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                    <tr><th scope="col" className="px-4 py-3">Name</th><th scope="col" className="px-4 py-3">Email</th><th scope="col" className="px-4 py-3">Role / access</th><th scope="col" className="px-4 py-3">Joined</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {dashboard.users.map((account) => (
                      <tr key={account.id}>
                        <td className="px-4 py-3 font-semibold text-slate-950">{account.firstName} {account.lastName}</td>
                        <td className="px-4 py-3 text-slate-700">{account.email}</td>
                        <td className="px-4 py-3 text-slate-700">{account.roles.join(", ") || "No role"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(account.createdAt)}</td>
                      </tr>
                    ))}
                    {dashboard.users.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-600">No users found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="tutors-heading" className="border-t border-slate-200 py-7">
              <h2 id="tutors-heading" className="text-xl font-bold text-slate-950">Approved Tutors</h2>
              <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200 sm:hidden">
                {dashboard.approvedTutors.map((tutor) => (
                  <article key={tutor.id} className="space-y-1 px-3 py-4">
                    <p className="font-semibold text-slate-950">{tutor.firstName} {tutor.lastName}</p>
                    <p className="break-all text-sm text-slate-700">{tutor.email}</p>
                    <p className="break-words text-sm text-slate-700">{tutor.subjects.join(", ") || "No subjects listed"}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-600">
                      <span>{formatRate(tutor.hourlyRate)}</span>
                      <span className={`inline-flex border px-2 py-1 font-semibold ${statusClass(tutor.approvalStatus)}`}>{tutor.approvalStatus}</span>
                    </div>
                  </article>
                ))}
                {dashboard.approvedTutors.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-600">No approved tutors yet.</p>}
              </div>
              <div className="mt-4 hidden overflow-x-auto border-y border-slate-200 sm:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                    <tr><th scope="col" className="px-4 py-3">Tutor</th><th scope="col" className="px-4 py-3">Subjects / modules</th><th scope="col" className="px-4 py-3">Hourly rate</th><th scope="col" className="px-4 py-3">Approval</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {dashboard.approvedTutors.map((tutor) => (
                      <tr key={tutor.id}>
                        <td className="px-4 py-3"><p className="font-semibold text-slate-950">{tutor.firstName} {tutor.lastName}</p><p className="mt-0.5 text-xs text-slate-600">{tutor.email}</p></td>
                        <td className="px-4 py-3 text-slate-700">{tutor.subjects.join(", ") || "No subjects listed"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatRate(tutor.hourlyRate)}</td>
                        <td className="px-4 py-3"><span className={`inline-flex border px-2 py-1 text-xs font-semibold ${statusClass(tutor.approvalStatus)}`}>{tutor.approvalStatus}</span></td>
                      </tr>
                    ))}
                    {dashboard.approvedTutors.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-600">No approved tutors yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
