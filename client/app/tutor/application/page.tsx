"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "../../components/Footer";
import Navbar from "../../components/Navbar";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")
  || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "");
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const DOCUMENT_TYPES = ["registration", "academicRecord"] as const;
type DocumentType = typeof DOCUMENT_TYPES[number];
type DocumentStatus = "PENDING" | "VERIFIED" | "REJECTED";

interface Applicant {
  firstName: string;
  lastName: string;
  email: string;
  institution: string;
}

interface ApplicationDocument {
  type: DocumentType;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  rejectionReason: string | null;
  uploadedAt: string;
  reviewedAt: string | null;
  downloadUrl: string;
}

interface TutorApplication {
  id: number;
  universityName: string | null;
  studentNumber: string | null;
  programme: string | null;
  yearOfStudy: number | null;
  motivation: string | null;
  experience: string | null;
  skillsDescription: string | null;
  subjects: string[];
  proposedHourlyRate: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  emailVerified: boolean;
  source: "USER" | "LEGACY";
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  documents: ApplicationDocument[];
}

interface ApplicationForm {
  universityName: string;
  studentNumber: string;
  programme: string;
  yearOfStudy: string;
  motivation: string;
  experience: string;
  skillsDescription: string;
  proposedHourlyRate: string;
  subjects: string[];
}

const emptyForm: ApplicationForm = {
  universityName: "",
  studentNumber: "",
  programme: "",
  yearOfStudy: "",
  motivation: "",
  experience: "",
  skillsDescription: "",
  proposedHourlyRate: "",
  subjects: []
};

function formatDate(value: string | null) {
  if (!value) return "Not submitted";
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "long" }).format(new Date(value));
}

export default function TutorApplicationPage() {
  const router = useRouter();
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [application, setApplication] = useState<TutorApplication | null>(null);
  const [applicationStarted, setApplicationStarted] = useState(false);
  const [form, setForm] = useState<ApplicationForm>(emptyForm);
  const [selectedDocuments, setSelectedDocuments] = useState<Record<DocumentType, File | null>>({
    registration: null,
    academicRecord: null
  });
  const [documentError, setDocumentError] = useState("");
  const [replacementDocumentType, setReplacementDocumentType] = useState<DocumentType | null>(null);
  const [moduleInput, setModuleInput] = useState("");
  const [moduleError, setModuleError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadApplicationPage() {
      try {
        if (!API_BASE_URL) {
          throw new Error("Tutor application API is not configured. Set NEXT_PUBLIC_API_URL to the Render API URL in Vercel.");
        }

        const authResponse = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" });
        if (authResponse.status === 401) {
          router.replace("/login?next=%2Ftutor%2Fapplication");
          return;
        }
        if (!authResponse.ok) throw new Error("Unable to verify your account.");

        const authData = await authResponse.json();
        const roles: string[] = authData.user?.roles || [];
        if (!roles.includes("STUDENT") && !roles.includes("TUTOR")) {
          router.replace(roles.includes("ADMIN") ? "/dashboard/admin" : "/login");
          return;
        }

        const applicationResponse = await fetch(`${API_BASE_URL}/api/tutor-applications/me`, { credentials: "include" });
        if (applicationResponse.status === 401) {
          router.replace("/login?next=%2Ftutor%2Fapplication");
          return;
        }
        if (applicationResponse.status === 404) {
          console.error("GET /api/tutor-applications/me returned HTTP 404. The deployed API may not include the tutor application route.");
          throw new Error("Tutor application service is not available. Deploy the latest backend routes and try again.");
        }
        if (!applicationResponse.ok) {
          console.error(`GET /api/tutor-applications/me failed with HTTP ${applicationResponse.status}.`);
          throw new Error("We could not load your application. Please try again.");
        }

        const applicationData = await applicationResponse.json();
        if (cancelled) return;
        setApplicant(applicationData.applicant || {
          firstName: authData.user.firstName,
          lastName: authData.user.lastName,
          email: authData.user.email,
          institution: authData.user.university
        });
        const loadedApplication: TutorApplication | null = applicationData.application || null;
        setApplication(loadedApplication);
        if (loadedApplication) {
          setForm({
            universityName: loadedApplication.universityName || applicationData.applicant?.institution || "",
            studentNumber: loadedApplication.studentNumber || "",
            programme: loadedApplication.programme || "",
            yearOfStudy: loadedApplication.yearOfStudy?.toString() || "",
            motivation: loadedApplication.motivation || "",
            experience: loadedApplication.experience || "",
            skillsDescription: loadedApplication.skillsDescription || "",
            proposedHourlyRate: loadedApplication.proposedHourlyRate?.toString() || "",
            subjects: loadedApplication.subjects || []
          });
          setApplication({
            ...loadedApplication,
            documents: loadedApplication.documents || []
          });
        } else {
          setForm((current) => ({
            ...current,
            universityName: applicationData.applicant?.institution || authData.user.university || ""
          }));
        }

      } catch (error) {
        console.error("Tutor application load failed:", error);
        if (!cancelled) {
          setPageError(error instanceof TypeError
            ? "Unable to connect to the application service. Check your internet connection and try again. If this continues, verify that NEXT_PUBLIC_API_URL points to the live API and that the API's CLIENT_URL or CORS_ALLOWED_ORIGINS includes this website's exact origin."
            : error instanceof Error
              ? error.message
              : "We could not load your application. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadApplicationPage();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function updateForm(field: keyof Omit<ApplicationForm, "subjects">, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validateDocumentFile(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    const allowed = extension === "pdf" && file.type === "application/pdf"
      || (extension === "jpg" || extension === "jpeg") && file.type === "image/jpeg"
      || extension === "png" && file.type === "image/png";
    if (!allowed) return "Choose a PDF, JPG, JPEG, or PNG file.";
    if (file.size > MAX_DOCUMENT_BYTES) return "Each document must be 5 MB or smaller.";
    return "";
  }

  function handleInitialDocument(type: DocumentType, file: File | null) {
    if (!file) return;
    const error = validateDocumentFile(file);
    if (error) {
      setDocumentError(error);
      return;
    }
    setDocumentError("");
    setSelectedDocuments((current) => ({ ...current, [type]: file }));
  }

  async function replaceRejectedDocument(type: DocumentType, file: File | null) {
    if (!file) return;
    const error = validateDocumentFile(file);
    if (error) {
      setDocumentError(error);
      return;
    }
    setDocumentError("");
    setReplacementDocumentType(type);
    try {
      const data = new FormData();
      data.append("document", file);
      const response = await fetch(`${API_BASE_URL}/api/tutor-applications/me/documents/${type}`, {
        method: "PUT",
        credentials: "include",
        body: data
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The replacement document could not be uploaded.");
      setApplication((current) => current ? {
        ...current,
        documents: [
          ...current.documents.filter((document) => document.type !== type),
          result.document as ApplicationDocument
        ]
      } : current);
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : "The replacement document could not be uploaded.");
    } finally {
      setReplacementDocumentType(null);
    }
  }

  function addModule(value = moduleInput) {
    const moduleName = value.trim();
    setModuleError("");
    if (!moduleName) {
      setModuleError("Enter a module name first.");
      return;
    }
    if (moduleName.length > 100) {
      setModuleError("Module names must be 100 characters or fewer.");
      return;
    }
    if (form.subjects.some((subject) => subject.toLowerCase() === moduleName.toLowerCase())) {
      setModuleError("That module is already on your list.");
      return;
    }
    if (form.subjects.length >= 20) {
      setModuleError("You can add up to 20 modules.");
      return;
    }
    setForm((current) => ({ ...current, subjects: [...current.subjects, moduleName] }));
    setModuleInput("");
  }

  function removeModule(moduleName: string) {
    setForm((current) => ({
      ...current,
      subjects: current.subjects.filter((subject) => subject !== moduleName)
    }));
  }

  async function submitApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    if (form.subjects.length === 0) {
      setSubmitError("Add at least one module you can tutor.");
      return;
    }
    if (!selectedDocuments.registration || !selectedDocuments.academicRecord) {
      setSubmitError("Upload both proof of university registration and an academic record.");
      return;
    }
    const rate = Number(form.proposedHourlyRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      setSubmitError("Enter a valid hourly rate greater than zero.");
      return;
    }

    setSubmitting(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        data.append(key, key === "subjects" ? JSON.stringify(value) : String(value));
      });
      data.append("registration", selectedDocuments.registration);
      data.append("academicRecord", selectedDocuments.academicRecord);
      const response = await fetch(`${API_BASE_URL}/api/tutor-applications`, {
        method: "POST",
        credentials: "include",
        body: data
      });
      const result = await response.json();
      if (!response.ok) {
        setSubmitError(result.error || "Your application could not be submitted.");
        return;
      }
      setApplication(result.application);
    } catch (error) {
      console.error("Tutor application submission failed:", error);
      setSubmitError("We could not reach the server. Your application was not submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  const submitted = Boolean(application?.submittedAt);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#F3EEFF] to-[#FFF0E8] text-[#241B3B]">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#6C4CF1]">Tutor applications</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#241B3B]">Tutor Application</h1>
          <p className="mt-2 text-sm text-[#625B71]">Tutor access is granted only after an application is reviewed and approved.</p>
        </div>

        {loading ? (
          <p className="rounded-xl border border-[#CFC4F8] bg-white/80 p-6 text-sm text-[#625B71] backdrop-blur-sm" role="status">Loading your application...</p>
        ) : pageError ? (
          <div className="rounded-xl border border-[#EF4444] bg-[#EF4444]/10 p-6 text-sm text-[#EF4444] font-medium backdrop-blur-sm" role="alert">{pageError}</div>
        ) : application?.status === "APPROVED" ? (
          <section className="rounded-xl border-l-4 border-[#22C55E] border-y border-r border-[#CFC4F8] bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <p className="text-xs font-bold uppercase text-[#22C55E]">Application status</p>
            <h2 className="mt-2 text-2xl font-bold text-[#241B3B]">Tutor application approved</h2>
            <p className="mt-3 text-sm leading-6 text-[#625B71]">Your tutor application has been approved. Tutor access is now available.</p>
            <p className="mt-3 text-xs text-[#625B71]">Submitted {formatDate(application.submittedAt)}</p>
            <ul className="mt-5 space-y-2 border-t border-[#CFC4F8]/40 pt-4">
              {DOCUMENT_TYPES.map((type) => {
                const document = application.documents.find((item) => item.type === type);
                return <li key={type} className="text-sm text-[#241B3B]">{type === "registration" ? "Registration proof" : "Academic record"}: <span className="font-semibold text-[#22C55E]">{document?.status || "MISSING"}</span></li>;
              })}
            </ul>
            <a href="/dashboard/tutor" style={{ background: "linear-gradient(90deg, #6C4CF1, #8B5CF6)" }} className="mt-6 inline-flex rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-md hover:opacity-95">Open Tutor Dashboard</a>
          </section>
        ) : application?.status === "REJECTED" && submitted ? (
          <section className="rounded-xl border-l-4 border-[#EF4444] border-y border-r border-[#CFC4F8] bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <p className="text-xs font-bold uppercase text-[#EF4444]">Application status</p>
            <h2 className="mt-2 text-2xl font-bold text-[#241B3B]">Application not approved</h2>
            <p className="mt-3 text-sm leading-6 text-[#625B71]">Your tutor application was not approved. Please contact EasyLearning support if you need clarification.</p>
            {application.rejectionReason && <p className="mt-4 border-t border-[#CFC4F8]/40 pt-4 text-sm text-[#241B3B]">{application.rejectionReason}</p>}
            <p className="mt-3 text-xs text-[#625B71]">Submitted {formatDate(application.submittedAt)}</p>
            <ul className="mt-5 space-y-2 border-t border-[#CFC4F8]/40 pt-4">
              {DOCUMENT_TYPES.map((type) => {
                const document = application.documents.find((item) => item.type === type);
                return (
                  <li key={type} className="text-sm text-[#241B3B]">
                    <span className="font-medium">{type === "registration" ? "Registration proof" : "Academic record"}:</span>{" "}
                    <span className="font-semibold">{document?.status || "MISSING"}</span>
                    {document?.rejectionReason && <span className="block text-[#EF4444]">{document.rejectionReason}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : submitted ? (
          <section className="rounded-xl border-l-4 border-[#FF8A4C] border-y border-r border-[#CFC4F8] bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <p className="text-xs font-bold uppercase text-[#FF8A4C]">Application status: Pending</p>
            <h2 className="mt-2 text-2xl font-bold text-[#241B3B]">Tutor application submitted</h2>
            <p className="mt-3 text-sm leading-6 text-[#625B71]">Thank you for applying to become an EasyLearning tutor. Your application is pending review.</p>
            <p className="mt-3 text-xs text-[#625B71]">Submitted {formatDate(application?.submittedAt || null)}</p>
            <div className="mt-6 space-y-4 border-t border-[#CFC4F8]/40 pt-5">
              <h3 className="font-semibold text-[#241B3B]">Academic verification documents</h3>
              {DOCUMENT_TYPES.map((type) => {
                const document = application?.documents.find((item) => item.type === type);
                const title = type === "registration" ? "Proof of university registration" : "Academic record";
                return (
                  <div key={type} className="rounded-lg border border-[#CFC4F8] bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#241B3B]">{title}</p>
                        <p className="mt-1 text-sm text-[#625B71]">{document?.fileName || "No document submitted"}</p>
                        <p className={`mt-1 text-xs font-semibold ${document?.status === "VERIFIED" ? "text-[#22C55E]" : document?.status === "REJECTED" ? "text-[#EF4444]" : "text-[#FF8A4C]"}`}>
                          {document?.status || "MISSING"}
                        </p>
                        {document?.rejectionReason && <p className="mt-2 text-sm text-[#EF4444]" role="alert">{document.rejectionReason}</p>}
                      </div>
                      {document?.status === "REJECTED" && application?.status === "PENDING" && (
                        <label className="cursor-pointer rounded-lg border border-[#6C4CF1] px-3 py-2 text-sm font-semibold text-[#6C4CF1]">
                          {replacementDocumentType === type ? "Uploading..." : "Replace document"}
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                            className="sr-only"
                            disabled={replacementDocumentType !== null}
                            onChange={(event) => {
                              void replaceRejectedDocument(type, event.target.files?.[0] || null);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
              {documentError && <p className="text-sm font-medium text-[#EF4444]" role="alert">{documentError}</p>}
            </div>
            {!application?.emailVerified && (
              <p className="mt-5 border-t border-[#CFC4F8]/40 pt-4 text-sm leading-6 text-[#FF8A4C]">
                Email verification is not configured, and your email is not marked as verified. Verification is not required for an administrator to review this application.
              </p>
            )}
          </section>
        ) : !application && !applicationStarted ? (
          <section className="rounded-xl border-l-4 border-[#6C4CF1] border-y border-r border-[#CFC4F8] bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <p className="text-xs font-bold uppercase text-[#6C4CF1]">Application status</p>
            <h2 className="mt-2 text-2xl font-bold text-[#241B3B]">No tutor application has been submitted yet.</h2>
            <p className="mt-3 text-sm leading-6 text-[#625B71]">You can start an application while continuing to use your Student account.</p>
            <button
              type="button"
              onClick={() => setApplicationStarted(true)}
              style={{ background: "linear-gradient(90deg, #6C4CF1, #8B5CF6)" }}
              className="mt-6 inline-flex rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-md hover:opacity-95"
            >
              Start Tutor Application
            </button>
          </section>
        ) : (
          <div className="space-y-6 rounded-2xl border border-[#CFC4F8] bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            {application?.source === "LEGACY" && (
              <div className="rounded-lg border-l-4 border-[#FF8A4C] bg-[#FF8A4C]/10 p-4 text-sm leading-6 text-[#241B3B]">
                Your existing Tutor access is paused while this application is reviewed. Complete and submit this form to request approval; your account and existing profile data are preserved.
              </div>
            )}

            <div className="grid gap-4 border-b border-[#CFC4F8]/40 pb-6 sm:grid-cols-2">
              <div><p className="text-xs font-semibold uppercase text-[#625B71]">Applicant</p><p className="mt-1 font-semibold text-[#241B3B]">{applicant?.firstName} {applicant?.lastName}</p></div>
              <div><p className="text-xs font-semibold uppercase text-[#625B71]">Student email</p><p className="mt-1 break-all font-semibold text-[#241B3B]">{applicant?.email}</p></div>
              <div><p className="text-xs font-semibold uppercase text-[#625B71]">Institution</p><p className="mt-1 font-semibold text-[#241B3B]">{applicant?.institution}</p></div>
            </div>

            <form onSubmit={submitApplication} className="space-y-7">
              <section aria-labelledby="academic-heading">
                <h2 id="academic-heading" className="text-lg font-bold text-[#241B3B]">Academic information</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="university-name" className="mb-1.5 block text-sm font-medium text-[#241B3B]">University name</label>
                    <input id="university-name" required maxLength={200} value={form.universityName} onChange={(event) => updateForm("universityName", event.target.value)} className="w-full rounded-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30" />
                  </div>
                  <div>
                    <label htmlFor="student-number" className="mb-1.5 block text-sm font-medium text-[#241B3B]">Student number <span className="font-normal text-[#625B71]">(optional)</span></label>
                    <input id="student-number" value={form.studentNumber} maxLength={80} onChange={(event) => updateForm("studentNumber", event.target.value)} className="w-full rounded-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30" />
                  </div>
                  <div>
                    <label htmlFor="programme" className="mb-1.5 block text-sm font-medium text-[#241B3B]">Qualification or degree/diploma</label>
                    <input id="programme" required maxLength={200} value={form.programme} onChange={(event) => updateForm("programme", event.target.value)} className="w-full rounded-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30" />
                  </div>
                  <div>
                    <label htmlFor="year-of-study" className="mb-1.5 block text-sm font-medium text-[#241B3B]">Year of study</label>
                    <select id="year-of-study" required value={form.yearOfStudy} onChange={(event) => updateForm("yearOfStudy", event.target.value)} className="w-full rounded-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30">
                      <option value="">Select year</option>
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              <section aria-labelledby="verification-heading">
                <h2 id="verification-heading" className="text-lg font-bold text-[#241B3B]">Academic Verification Documents</h2>
                <p className="mt-1 text-sm text-[#625B71]">Upload current registration proof and your academic record. PDF, JPG, JPEG, or PNG only; maximum 5 MB per file.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {DOCUMENT_TYPES.map((type) => (
                      <div key={type} className="rounded-lg border border-[#CFC4F8] bg-white p-4">
                        <p id={`document-label-${type}`} className="text-sm font-semibold text-[#241B3B]">
                        {type === "registration" ? "Proof of University Registration" : "Academic Record"}
                        </p>
                      <input
                        id={`document-${type}`}
                        type="file"
                        required={!selectedDocuments[type]}
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        disabled={submitting}
                          aria-labelledby={`document-label-${type}`}
                          onChange={(event) => {
                            handleInitialDocument(type, event.target.files?.[0] || null);
                            event.currentTarget.value = "";
                          }}
                          className="sr-only"
                        />
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <label
                            htmlFor={`document-${type}`}
                            className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-[#6C4CF1] px-4 py-2 text-sm font-semibold text-[#6C4CF1] transition hover:bg-[#6C4CF1]/5"
                          >
                            {selectedDocuments[type] ? "Replace file" : "Choose file"}
                          </label>
                          <p className="min-w-0 break-all text-sm text-[#625B71]" role="status">
                            {selectedDocuments[type]?.name || "No file selected"}
                          </p>
                        </div>
                      </div>
                  ))}
                </div>
                {documentError && <p className="mt-3 text-sm font-medium text-[#EF4444]" role="alert">{documentError}</p>}
              </section>

              <section aria-labelledby="tutoring-heading">
                <h2 id="tutoring-heading" className="text-lg font-bold text-[#241B3B]">Tutoring information</h2>
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="motivation" className="mb-1.5 block text-sm font-medium text-[#241B3B]">Why do you want to become a tutor?</label>
                    <textarea id="motivation" required minLength={20} maxLength={3000} rows={4} value={form.motivation} onChange={(event) => updateForm("motivation", event.target.value)} className="w-full resize-y rounded-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30" />
                  </div>
                  <div>
                    <label htmlFor="experience" className="mb-1.5 block text-sm font-medium text-[#241B3B]">Tutoring experience <span className="font-normal text-[#625B71]">(optional)</span></label>
                    <textarea id="experience" maxLength={3000} rows={3} value={form.experience} onChange={(event) => updateForm("experience", event.target.value)} className="w-full resize-y rounded-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30" />
                  </div>
                  <div>
                    <label htmlFor="skills-description" className="mb-1.5 block text-sm font-medium text-[#241B3B]">Describe your knowledge and skills</label>
                    <textarea id="skills-description" required minLength={20} maxLength={3000} rows={4} value={form.skillsDescription} onChange={(event) => updateForm("skillsDescription", event.target.value)} className="w-full resize-y rounded-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30" />
                  </div>
                </div>
              </section>

              <section aria-labelledby="subjects-heading">
                <h2 id="subjects-heading" className="text-lg font-bold text-[#241B3B]">Modules I can tutor</h2>
                <p className="mt-1 text-sm text-[#625B71]">Enter each module you can tutor and add it to your list.</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <label htmlFor="tutor-module" className="sr-only">Module you can tutor</label>
                  <input
                    id="tutor-module"
                    value={moduleInput}
                    maxLength={100}
                    onChange={(event) => {
                      setModuleInput(event.target.value);
                      setModuleError("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addModule();
                      }
                    }}
                    placeholder="e.g. Data Structures"
                    disabled={submitting || form.subjects.length >= 20}
                    className="w-full rounded-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30"
                  />
                  <button
                    type="button"
                    onClick={() => addModule()}
                    disabled={submitting || form.subjects.length >= 20}
                    className="min-h-10 shrink-0 rounded-lg border border-[#6C4CF1] px-4 py-2 text-sm font-semibold text-[#6C4CF1] transition hover:bg-[#6C4CF1]/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add module
                  </button>
                </div>
                {moduleError && <p className="mt-2 text-sm font-medium text-[#EF4444]" role="alert">{moduleError}</p>}
                {form.subjects.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2" aria-label="Modules you can tutor">
                    {form.subjects.map((subject) => (
                      <li key={subject} className="flex items-center gap-2 rounded-lg border border-[#CFC4F8] bg-white px-3 py-2 text-sm text-[#241B3B]">
                        <span>{subject}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${subject}`}
                          onClick={() => removeModule(subject)}
                          disabled={submitting}
                          className="font-semibold text-[#625B71] hover:text-[#EF4444] disabled:cursor-not-allowed"
                        >
                          x
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="rate-heading">
                <h2 id="rate-heading" className="text-lg font-bold text-[#241B3B]">Proposed hourly rate</h2>
                <label htmlFor="hourly-rate" className="mt-3 block text-sm font-medium text-[#241B3B]">Rate in rand per hour</label>
                <div className="mt-1.5 flex max-w-sm items-center gap-2">
                  <span className="rounded-l-lg border border-r-0 border-[#CFC4F8] bg-[#EDE7FF] px-3 py-2.5 text-sm font-semibold text-[#6C4CF1]">R</span>
                  <input id="hourly-rate" type="number" inputMode="decimal" min="0.01" max="100000" step="0.01" required value={form.proposedHourlyRate} onChange={(event) => updateForm("proposedHourlyRate", event.target.value)} className="w-full rounded-r-lg border border-[#CFC4F8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30" />
                </div>
              </section>

              {submitError && <p className="text-sm font-medium text-[#EF4444]" role="alert">{submitError}</p>}
              <div className="border-t border-[#CFC4F8]/40 pt-5">
                <p className="mb-4 text-xs leading-5 text-[#625B71]">Email verification is not available yet. Submitting records a pending application; it does not verify your email or grant Tutor access.</p>
                <button type="submit" disabled={submitting || !selectedDocuments.registration || !selectedDocuments.academicRecord} style={{ background: "linear-gradient(90deg, #6C4CF1, #8B5CF6)" }} className="inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? "Submitting application..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}