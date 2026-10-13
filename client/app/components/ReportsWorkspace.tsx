"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "./DashboardShell";
import type { ReportRecord } from "../lib/reports";
import { REPORT_CATEGORIES } from "../lib/reports";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

type DashboardRole = "STUDENT" | "TUTOR" | "ADMIN";
type WorkspaceMode = "submit" | "history";

interface ReportUser {
  firstName: string;
  lastName: string;
  roles: DashboardRole[];
}

async function readError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : fallback;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusStyle(status: string) {
  if (status === "RESOLVED") return "border-[#22C55E]/40 bg-[#22C55E]/10 text-[#22C55E]";
  if (status === "CLOSED") return "border-[#625B71]/30 bg-[#F3EEFF] text-[#625B71]";
  if (status === "IN_REVIEW") return "border-[#6C4CF1]/40 bg-[#6C4CF1]/10 text-[#6C4CF1]";
  return "border-[#FF8A4C]/40 bg-[#FF8A4C]/10 text-[#FF8A4C]";
}

export default function ReportsWorkspace({ mode }: { mode: WorkspaceMode }) {
  const router = useRouter();
  const [user, setUser] = useState<ReportUser | null>(null);
  const [authError, setAuthError] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportsError, setReportsError] = useState("");
  const [category, setCategory] = useState<(typeof REPORT_CATEGORIES)[number] | "">("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submissionInProgress = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) throw new Error(await readError(response, "Unable to verify your account."));

        const data = await response.json();
        const roles = Array.isArray(data.user?.roles)
          ? data.user.roles.filter((role: string): role is DashboardRole =>
            role === "STUDENT" || role === "TUTOR" || role === "ADMIN")
          : [];
        if (roles.length === 0) {
          router.replace("/login");
          return;
        }
        if (!cancelled) {
          setUser({
            firstName: data.user.firstName,
            lastName: data.user.lastName,
            roles
          });
        }
      } catch (error) {
        if (!cancelled) setAuthError(error instanceof Error ? error.message : "Unable to verify your account.");
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    }

    void loadUser();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (mode !== "history" || !user) return;
    let cancelled = false;

    async function loadReports() {
      setLoadingReports(true);
      setReportsError("");
      try {
        const response = await fetch(`${API_BASE_URL}/api/reports/mine`, { credentials: "include" });
        if (!response.ok) throw new Error(await readError(response, "Unable to load your reports."));
        const data = await response.json() as { reports?: ReportRecord[] };
        if (!cancelled) setReports(Array.isArray(data.reports) ? data.reports : []);
      } catch (error) {
        if (!cancelled) setReportsError(error instanceof Error ? error.message : "Unable to load your reports.");
      } finally {
        if (!cancelled) setLoadingReports(false);
      }
    }

    void loadReports();
    return () => {
      cancelled = true;
    };
  }, [mode, user]);

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null;
    setAttachmentError("");
    setSubmitError("");
    if (!selected) {
      setAttachment(null);
      return;
    }
    if (!ACCEPTED_ATTACHMENT_TYPES.has(selected.type)) {
      event.target.value = "";
      setAttachment(null);
      setAttachmentError("Choose a PDF, JPG, JPEG, or PNG file.");
      return;
    }
    if (selected.size > MAX_ATTACHMENT_BYTES) {
      event.target.value = "";
      setAttachment(null);
      setAttachmentError("The attachment must be 5 MB or smaller.");
      return;
    }
    setAttachment(selected);
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInProgress.current) return;
    setSubmitError("");
    setSuccessMessage("");
    if (!category || !subject.trim() || !description.trim()) {
      setSubmitError("Choose a category and complete the subject and description.");
      return;
    }
    if (subject.trim().length > 160 || description.trim().length > 5000) {
      setSubmitError("Subject must be 160 characters or fewer and description 5000 characters or fewer.");
      return;
    }
    if (attachmentError) {
      setSubmitError(attachmentError);
      return;
    }

    submissionInProgress.current = true;
    setSubmitting(true);
    const body = new FormData();
    body.set("category", category);
    body.set("subject", subject.trim());
    body.set("description", description.trim());
    if (attachment) body.set("attachment", attachment);

    try {
      const response = await fetch(`${API_BASE_URL}/api/reports`, {
        method: "POST",
        credentials: "include",
        body
      });
      if (!response.ok) throw new Error(await readError(response, "Unable to submit your report."));
      setSuccessMessage("Your report has been submitted.");
      setCategory("");
      setSubject("");
      setDescription("");
      setAttachment(null);
      const fileInput = document.getElementById("report-attachment") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit your report.");
    } finally {
      submissionInProgress.current = false;
      setSubmitting(false);
    }
  }

  const dashboardRole: DashboardRole | null = user
    ? user.roles.includes("ADMIN") ? "ADMIN" : user.roles.includes("TUTOR") ? "TUTOR" : "STUDENT"
    : null;
  const dashboardHref = dashboardRole === "ADMIN"
    ? "/dashboard/admin"
    : dashboardRole === "TUTOR"
      ? "/dashboard/tutor"
      : "/dashboard/student";

  if (loadingUser || !dashboardRole || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F3EEFF] to-[#FFF0E8] px-5 text-[#625B71]" role={authError ? "alert" : "status"}>
        <div className="text-center">
          <p>{authError || "Loading your account..."}</p>
          {authError && <button type="button" onClick={() => window.location.reload()} className="mt-3 font-semibold text-[#6C4CF1] underline">Retry</button>}
        </div>
      </div>
    );
  }

  return (
    <DashboardShell
      role={dashboardRole}
      activeItem={mode === "submit" ? "Report a Problem" : "My Reports"}
      user={user}
    >
      {mode === "submit" ? (
        <div className="mx-auto max-w-3xl">
          <div className="border-b border-[#CFC4F8] pb-5">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#6C4CF1]">Help and support</p>
            <h1 className="mt-1 text-3xl font-bold text-[#241B3B]">Report a Problem</h1>
            <p className="mt-2 text-sm leading-6 text-[#625B71]">Tell us what happened. Your report is linked to your account automatically.</p>
          </div>

          {successMessage && <p className="mt-5 rounded-lg border border-[#22C55E]/30 bg-[#22C55E]/10 p-4 text-sm text-[#166534]" role="status">{successMessage} <Link href="/my-reports" className="font-semibold underline">View My Reports</Link></p>}
          {submitError && <p className="mt-5 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 p-4 text-sm text-[#B91C1C]" role="alert">{submitError}</p>}

          <form onSubmit={submitReport} className="mt-6 space-y-5 rounded-xl border border-[#CFC4F8] bg-white/90 p-5 shadow-sm sm:p-7">
            <div>
              <label htmlFor="report-category" className="block text-sm font-semibold text-[#241B3B]">Report category <span aria-hidden="true">*</span></label>
              <select
                id="report-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as (typeof REPORT_CATEGORIES)[number] | "")}
                required
                className="mt-2 w-full rounded-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm text-[#241B3B] focus:border-[#6C4CF1] focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/20"
              >
                <option value="">Select a category</option>
                {REPORT_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="report-subject" className="block text-sm font-semibold text-[#241B3B]">Subject <span aria-hidden="true">*</span></label>
              <input
                id="report-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                required
                maxLength={160}
                autoComplete="off"
                className="mt-2 w-full rounded-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm text-[#241B3B] focus:border-[#6C4CF1] focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/20"
              />
              <p className="mt-1 text-right text-xs text-[#625B71]">{subject.length}/160</p>
            </div>

            <div>
              <label htmlFor="report-description" className="block text-sm font-semibold text-[#241B3B]">Description <span aria-hidden="true">*</span></label>
              <textarea
                id="report-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                maxLength={5000}
                rows={7}
                className="mt-2 w-full resize-y rounded-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm leading-6 text-[#241B3B] focus:border-[#6C4CF1] focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/20"
              />
              <p className="mt-1 text-right text-xs text-[#625B71]">{description.length}/5000</p>
            </div>

            <div>
              <label htmlFor="report-attachment" className="block text-sm font-semibold text-[#241B3B]">Attachment <span className="font-normal text-[#625B71]">(optional)</span></label>
              <input
                id="report-attachment"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={handleAttachmentChange}
                className="mt-2 block w-full text-sm text-[#625B71] file:mr-3 file:rounded-md file:border-0 file:bg-[#EDE7FF] file:px-3 file:py-2 file:font-semibold file:text-[#6C4CF1]"
              />
              <p className="mt-1 text-xs text-[#625B71]">PDF, JPG, JPEG, or PNG; maximum 5 MB.</p>
              {attachment && <p className="mt-1 break-all text-xs text-[#241B3B]">Selected: {attachment.name}</p>}
              {attachmentError && <p className="mt-1 text-sm text-[#B91C1C]" role="alert">{attachmentError}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-[#CFC4F8] pt-5">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#6C4CF1] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5B3FD2] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </button>
              <Link href={dashboardHref} className="rounded-lg border border-[#CFC4F8] px-5 py-2.5 text-sm font-semibold text-[#625B71] hover:bg-[#F3EEFF]">Cancel</Link>
            </div>
          </form>
        </div>
      ) : (
        <section aria-labelledby="my-reports-heading" className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#CFC4F8] pb-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#6C4CF1]">Help and support</p>
              <h1 id="my-reports-heading" className="mt-1 text-3xl font-bold text-[#241B3B]">My Reports</h1>
            </div>
            <Link href="/report-problem" className="rounded-lg bg-[#6C4CF1] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5B3FD2]">Report a Problem</Link>
          </div>

          {loadingReports && <p className="py-8 text-sm text-[#625B71]" role="status">Loading your reports...</p>}
          {reportsError && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 p-4 text-sm text-[#B91C1C]" role="alert">
              <p>{reportsError}</p>
              <button type="button" onClick={() => window.location.reload()} className="font-semibold underline">Retry</button>
            </div>
          )}
          {!loadingReports && !reportsError && reports.length === 0 && (
            <p className="mt-6 rounded-xl border border-dashed border-[#CFC4F8] bg-white/70 px-5 py-10 text-center text-sm text-[#625B71]">You have not submitted any reports yet.</p>
          )}
          <div className="mt-5 space-y-3">
            {reports.map((report) => (
              <article key={report.id} className="rounded-xl border border-[#CFC4F8] bg-white/90 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-base font-bold text-[#241B3B]">{report.subject}</h2>
                    <p className="mt-1 text-sm text-[#625B71]">{report.category}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle(report.status)}`}>{report.status.replace("_", " ")}</span>
                </div>
                <p className="mt-3 text-xs text-[#625B71]">Submitted {formatDate(report.createdAt)}</p>
                {report.response && <div className="mt-4 rounded-lg bg-[#F3EEFF] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#6C4CF1]">Response</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#241B3B]">{report.response}</p></div>}
                {report.attachmentUrl && <a href={`${API_BASE_URL}${report.attachmentUrl}`} target="_blank" rel="noreferrer" className="mt-3 inline-block break-all text-sm font-semibold text-[#6C4CF1] underline">View attachment: {report.attachmentName}</a>}
              </article>
            ))}
          </div>
        </section>
      )}
    </DashboardShell>
  );
}
