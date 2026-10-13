"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { REPORT_CATEGORIES, REPORT_STATUSES, type ReportCategory, type ReportRecord, type ReportStatus } from "../lib/reports";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function readError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : fallback;
}

async function fetchAdminReports(): Promise<ReportRecord[]> {
  const result = await fetch(`${API_BASE_URL}/api/reports/admin`, { credentials: "include" });
  if (!result.ok) throw new Error(await readError(result, "Unable to load reported issues."));
  const data = await result.json() as { reports?: ReportRecord[] };
  return Array.isArray(data.reports) ? data.reports : [];
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusStyle(status: ReportStatus) {
  if (status === "RESOLVED") return "border-[#22C55E]/40 bg-[#22C55E]/10 text-[#22C55E]";
  if (status === "CLOSED") return "border-[#625B71]/30 bg-[#F3EEFF] text-[#625B71]";
  if (status === "IN_REVIEW") return "border-[#6C4CF1]/40 bg-[#6C4CF1]/10 text-[#6C4CF1]";
  return "border-[#FF8A4C]/40 bg-[#FF8A4C]/10 text-[#FF8A4C]";
}

export default function AdminReportsSection() {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [nextStatus, setNextStatus] = useState<ReportStatus>("OPEN");
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReports(await fetchAdminReports());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load reported issues.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAdminReports()
      .then((data) => {
        if (!cancelled) setReports(data);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load reported issues.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function retryLoadReports() {
    void loadReports();
  }

  const filteredReports = reports.filter((report) =>
    (statusFilter === "ALL" || report.status === statusFilter)
    && (categoryFilter === "ALL" || report.category === categoryFilter)
  );
  const selectedReport = reports.find((report) => report.id === selectedId) || null;

  function selectReport(report: ReportRecord) {
    setSelectedId(report.id);
    setNextStatus(report.status);
    setResponse(report.response || "");
    setActionError("");
    setNotice("");
  }

  async function updateReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedReport) return;
    setSaving(true);
    setActionError("");
    setNotice("");
    try {
      const result = await fetch(`${API_BASE_URL}/api/reports/${selectedReport.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus, response })
      });
      if (!result.ok) throw new Error(await readError(result, "Unable to update this report."));
      const data = await result.json() as { report: ReportRecord };
      setReports((current) => current.map((report) => report.id === data.report.id ? {
        ...report,
        status: data.report.status,
        response: data.report.response,
        updatedAt: data.report.updatedAt
      } : report));
      setNotice("Report updated.");
    } catch (updateError) {
      setActionError(updateError instanceof Error ? updateError.message : "Unable to update this report.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="reports-heading" aria-labelledby="reports-title" className="scroll-mt-24 border-t border-[#CFC4F8] py-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="reports-title" className="text-xl font-bold text-[#241B3B]">Reported Issues</h2>
          <p className="mt-1 text-sm text-[#625B71]">Review user reports and send a response to the reporting user.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-xs font-semibold text-[#625B71]">
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ReportStatus | "ALL")} className="mt-1 block rounded-lg border border-[#CFC4F8] bg-white px-3 py-2 text-sm text-[#241B3B]">
              <option value="ALL">All statuses</option>
              {REPORT_STATUSES.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-[#625B71]">
            Category
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as ReportCategory | "ALL")} className="mt-1 block max-w-60 rounded-lg border border-[#CFC4F8] bg-white px-3 py-2 text-sm text-[#241B3B]">
              <option value="ALL">All categories</option>
              {REPORT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
        </div>
      </div>

      {loading && <p className="py-8 text-sm text-[#625B71]" role="status">Loading reported issues...</p>}
      {error && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 p-4 text-sm text-[#B91C1C]" role="alert">
          <p>{error}</p>
          <button type="button" onClick={retryLoadReports} className="font-semibold underline">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mt-5 space-y-3 sm:hidden">
            {filteredReports.map((report) => (
              <article key={report.id} className="rounded-xl border border-[#CFC4F8] bg-white/90 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold text-[#241B3B]">{report.subject}</h3>
                    <p className="mt-1 text-xs text-[#625B71]">{report.category}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${statusStyle(report.status)}`}>{report.status.replace("_", " ")}</span>
                </div>
                <p className="mt-2 break-words text-xs text-[#625B71]">{report.reporter?.name} · {report.reporter?.email}</p>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#625B71]">
                  <span>{formatDate(report.createdAt)}</span>
                  <button type="button" onClick={() => selectReport(report)} className="font-semibold text-[#6C4CF1] underline">View report</button>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 hidden overflow-x-auto rounded-xl border border-[#CFC4F8] bg-white/90 sm:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#EDE7FF]/60 text-xs uppercase text-[#625B71]">
                <tr>
                  <th scope="col" className="px-4 py-3">Reporter</th>
                  <th scope="col" className="px-4 py-3">Category / subject</th>
                  <th scope="col" className="px-4 py-3">Submitted</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">View</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CFC4F8]">
                {filteredReports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-4 py-3"><p className="font-semibold text-[#241B3B]">{report.reporter?.name}</p><p className="mt-0.5 text-xs text-[#625B71]">{report.reporter?.email}</p></td>
                    <td className="px-4 py-3"><p className="text-xs text-[#625B71]">{report.category}</p><p className="mt-1 font-semibold text-[#241B3B]">{report.subject}</p></td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#625B71]">{formatDate(report.createdAt)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusStyle(report.status)}`}>{report.status.replace("_", " ")}</span></td>
                    <td className="px-4 py-3 text-right"><button type="button" onClick={() => selectReport(report)} className="font-semibold text-[#6C4CF1] underline">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredReports.length === 0 && <p className="mt-5 rounded-xl border border-dashed border-[#CFC4F8] px-4 py-8 text-center text-sm text-[#625B71]">No reports match these filters.</p>}
        </>
      )}

      {selectedReport && (
        <article className="mt-6 rounded-xl border-l-4 border-[#6C4CF1] border-y border-r border-[#CFC4F8] bg-white/95 p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#CFC4F8]/60 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#6C4CF1]">{selectedReport.category}</p>
              <h3 className="mt-1 break-words text-xl font-bold text-[#241B3B]">{selectedReport.subject}</h3>
              <p className="mt-2 break-words text-sm text-[#625B71]">
                {selectedReport.reporter?.name} ({selectedReport.reporter?.roles.join(", ")}) · {selectedReport.reporter?.email}
              </p>
              <p className="mt-1 text-xs text-[#625B71]">Submitted {formatDate(selectedReport.createdAt)}</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle(selectedReport.status)}`}>{selectedReport.status.replace("_", " ")}</span>
          </div>

          <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-6 text-[#241B3B]">{selectedReport.description}</p>
          {selectedReport.attachmentUrl && <a href={`${API_BASE_URL}${selectedReport.attachmentUrl}`} target="_blank" rel="noreferrer" className="mt-4 inline-block break-all text-sm font-semibold text-[#6C4CF1] underline">Review attachment: {selectedReport.attachmentName}</a>}

          <form onSubmit={updateReport} className="mt-6 space-y-4 border-t border-[#CFC4F8]/60 pt-5">
            <div>
              <label htmlFor="report-status" className="block text-sm font-semibold text-[#241B3B]">Status</label>
              <select id="report-status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as ReportStatus)} className="mt-1 w-full max-w-xs rounded-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm text-[#241B3B]">
                {REPORT_STATUSES.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="report-response" className="block text-sm font-semibold text-[#241B3B]">Response to reporting user</label>
              <textarea id="report-response" value={response} onChange={(event) => setResponse(event.target.value)} maxLength={3000} rows={4} className="mt-1 w-full rounded-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm leading-6 text-[#241B3B]" />
              <p className="mt-1 text-right text-xs text-[#625B71]">{response.length}/3000</p>
            </div>
            {actionError && <p role="alert" className="text-sm text-[#B91C1C]">{actionError}</p>}
            {notice && <p role="status" className="text-sm text-[#166534]">{notice}</p>}
            <button type="submit" disabled={saving} className="rounded-lg bg-[#6C4CF1] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5B3FD2] disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Saving..." : "Save Report Update"}
            </button>
          </form>
        </article>
      )}
    </section>
  );
}
