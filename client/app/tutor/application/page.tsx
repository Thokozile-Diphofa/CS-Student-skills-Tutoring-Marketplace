"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "../../components/Footer";
import Navbar from "../../components/Navbar";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")
  || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "");

interface Applicant {
  firstName: string;
  lastName: string;
  email: string;
  institution: string;
}

interface TutorApplication {
  id: number;
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
}

interface ApplicationForm {
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
  const [subjects, setSubjects] = useState<string[]>([]);
  const [form, setForm] = useState<ApplicationForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subjectsError, setSubjectsError] = useState("");
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

        const [applicationResponse, subjectsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/tutor-applications/me`, { credentials: "include" }),
          fetch(`${API_BASE_URL}/api/tutor-applications/subjects`, { credentials: "include" })
        ]);
        if (applicationResponse.status === 401 || subjectsResponse.status === 401) {
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
            studentNumber: loadedApplication.studentNumber || "",
            programme: loadedApplication.programme || "",
            yearOfStudy: loadedApplication.yearOfStudy?.toString() || "",
            motivation: loadedApplication.motivation || "",
            experience: loadedApplication.experience || "",
            skillsDescription: loadedApplication.skillsDescription || "",
            proposedHourlyRate: loadedApplication.proposedHourlyRate?.toString() || "",
            subjects: loadedApplication.subjects || []
          });
        }

        if (subjectsResponse.ok) {
          const subjectsData = await subjectsResponse.json();
          if (!cancelled) setSubjects(Array.isArray(subjectsData.subjects) ? subjectsData.subjects : []);
        } else if (!cancelled) {
          console.error(`GET /api/tutor-applications/subjects failed with HTTP ${subjectsResponse.status}.`);
          setSubjectsError(subjectsResponse.status === 404
            ? "Tutor application routes are not available on the configured API. Deploy the latest backend."
            : "Available subjects could not be loaded.");
        }
      } catch (error) {
        console.error("Tutor application load failed:", error);
        if (!cancelled) setPageError(error instanceof Error ? error.message : "We could not load your application. Please try again.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSubjectsLoading(false);
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

  function toggleSubject(subject: string) {
    setForm((current) => ({
      ...current,
      subjects: current.subjects.includes(subject)
        ? current.subjects.filter((selected) => selected !== subject)
        : [...current.subjects, subject]
    }));
  }

  async function submitApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    if (form.subjects.length === 0) {
      setSubmitError("Select at least one subject.");
      return;
    }
    const rate = Number(form.proposedHourlyRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      setSubmitError("Enter a valid hourly rate greater than zero.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tutor-applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          yearOfStudy: Number(form.yearOfStudy),
          proposedHourlyRate: rate
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setSubmitError(data.error || "Your application could not be submitted.");
        return;
      }
      setApplication(data.application);
    } catch (error) {
      console.error("Tutor application submission failed:", error);
      setSubmitError("We could not reach the server. Your application was not submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  const submitted = Boolean(application?.submittedAt);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase text-amber-700">Tutor applications</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Tutor Application</h1>
          <p className="mt-2 text-sm text-slate-600">Tutor access is granted only after an application is reviewed and approved.</p>
        </div>

        {loading ? (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600" role="status">Loading your application...</p>
        ) : pageError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800" role="alert">{pageError}</div>
        ) : application?.status === "APPROVED" ? (
          <section className="border-l-4 border-emerald-500 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase text-emerald-700">Application status</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Tutor application approved</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Your tutor application has been approved. Tutor access is now available.</p>
            <p className="mt-3 text-xs text-slate-500">Submitted {formatDate(application.submittedAt)}</p>
            <a href="/dashboard/tutor" className="mt-6 inline-flex rounded-lg bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-300">Open Tutor Dashboard</a>
          </section>
        ) : application?.status === "REJECTED" && submitted ? (
          <section className="border-l-4 border-slate-400 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase text-slate-600">Application status</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Application not approved</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Your tutor application was not approved. Please contact EasyLearning support if you need clarification.</p>
            {application.rejectionReason && <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-700">{application.rejectionReason}</p>}
            <p className="mt-3 text-xs text-slate-500">Submitted {formatDate(application.submittedAt)}</p>
          </section>
        ) : submitted ? (
          <section className="border-l-4 border-amber-400 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase text-amber-700">Application status: Pending</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Tutor application submitted</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Thank you for applying to become an EasyLearning tutor. Your application is pending review.</p>
            <p className="mt-3 text-xs text-slate-500">Submitted {formatDate(application?.submittedAt || null)}</p>
            {!application?.emailVerified && (
              <p className="mt-5 border-t border-amber-100 pt-4 text-sm leading-6 text-amber-900">
                Email verification is not configured yet. Your email has not been verified, and an administrator cannot approve the application until a real verification step is available.
              </p>
            )}
          </section>
        ) : !application && !applicationStarted ? (
          <section className="border-l-4 border-amber-400 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase text-slate-500">Application status</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">No tutor application has been submitted yet.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">You can start an application while continuing to use your Student account.</p>
            <button
              type="button"
              onClick={() => setApplicationStarted(true)}
              className="mt-6 inline-flex rounded-lg bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-300"
            >
              Start Tutor Application
            </button>
          </section>
        ) : (
          <div className="space-y-6">
            {application?.source === "LEGACY" && (
              <div className="border-l-4 border-amber-400 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                Your existing Tutor access is paused while this application is reviewed. Complete and submit this form to request approval; your account and existing profile data are preserved.
              </div>
            )}

            <div className="grid gap-4 border-b border-slate-200 pb-6 sm:grid-cols-2">
              <div><p className="text-xs font-semibold uppercase text-slate-500">Applicant</p><p className="mt-1 font-semibold text-slate-900">{applicant?.firstName} {applicant?.lastName}</p></div>
              <div><p className="text-xs font-semibold uppercase text-slate-500">Student email</p><p className="mt-1 break-all font-semibold text-slate-900">{applicant?.email}</p></div>
              <div><p className="text-xs font-semibold uppercase text-slate-500">Institution</p><p className="mt-1 font-semibold text-slate-900">{applicant?.institution}</p></div>
            </div>

            <form onSubmit={submitApplication} className="space-y-7">
              <section aria-labelledby="academic-heading">
                <h2 id="academic-heading" className="text-lg font-bold text-slate-950">Academic information</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="student-number" className="mb-1.5 block text-sm font-medium text-slate-700">Student number <span className="font-normal text-slate-500">(optional)</span></label>
                    <input id="student-number" value={form.studentNumber} maxLength={80} onChange={(event) => updateForm("studentNumber", event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label htmlFor="programme" className="mb-1.5 block text-sm font-medium text-slate-700">Programme or course</label>
                    <input id="programme" required maxLength={200} value={form.programme} onChange={(event) => updateForm("programme", event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label htmlFor="year-of-study" className="mb-1.5 block text-sm font-medium text-slate-700">Year of study</label>
                    <select id="year-of-study" required value={form.yearOfStudy} onChange={(event) => updateForm("yearOfStudy", event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500">
                      <option value="">Select year</option>
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              <section aria-labelledby="tutoring-heading">
                <h2 id="tutoring-heading" className="text-lg font-bold text-slate-950">Tutoring information</h2>
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="motivation" className="mb-1.5 block text-sm font-medium text-slate-700">Why do you want to become a tutor?</label>
                    <textarea id="motivation" required minLength={20} maxLength={3000} rows={4} value={form.motivation} onChange={(event) => updateForm("motivation", event.target.value)} className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label htmlFor="experience" className="mb-1.5 block text-sm font-medium text-slate-700">Tutoring experience <span className="font-normal text-slate-500">(optional)</span></label>
                    <textarea id="experience" maxLength={3000} rows={3} value={form.experience} onChange={(event) => updateForm("experience", event.target.value)} className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label htmlFor="skills-description" className="mb-1.5 block text-sm font-medium text-slate-700">Describe your knowledge and skills</label>
                    <textarea id="skills-description" required minLength={20} maxLength={3000} rows={4} value={form.skillsDescription} onChange={(event) => updateForm("skillsDescription", event.target.value)} className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
                  </div>
                </div>
              </section>

              <section aria-labelledby="subjects-heading">
                <h2 id="subjects-heading" className="text-lg font-bold text-slate-950">Subjects I can tutor</h2>
                <p className="mt-1 text-sm text-slate-600">Choose from subjects currently listed in EasyLearning.</p>
                {subjectsLoading ? (
                  <p className="mt-4 text-sm text-slate-500" role="status">Loading subjects...</p>
                ) : subjectsError ? (
                  <p className="mt-4 text-sm text-red-700" role="alert">{subjectsError}</p>
                ) : subjects.length === 0 ? (
                  <p className="mt-4 border border-dashed border-slate-300 p-4 text-sm text-slate-600">No subjects are available yet. Applications cannot be submitted until subjects exist in EasyLearning.</p>
                ) : (
                  <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
                    <legend className="sr-only">Available tutoring subjects</legend>
                    {subjects.map((subject) => (
                      <label key={subject} className="flex cursor-pointer items-center gap-3 border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 hover:border-amber-400">
                        <input type="checkbox" checked={form.subjects.includes(subject)} onChange={() => toggleSubject(subject)} className="h-4 w-4 accent-amber-500" />
                        {subject}
                      </label>
                    ))}
                  </fieldset>
                )}
              </section>

              <section aria-labelledby="rate-heading">
                <h2 id="rate-heading" className="text-lg font-bold text-slate-950">Proposed hourly rate</h2>
                <label htmlFor="hourly-rate" className="mt-3 block text-sm font-medium text-slate-700">Rate in rand per hour</label>
                <div className="mt-1.5 flex max-w-sm items-center gap-2">
                  <span className="rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-600">R</span>
                  <input id="hourly-rate" type="number" inputMode="decimal" min="0.01" max="100000" step="0.01" required value={form.proposedHourlyRate} onChange={(event) => updateForm("proposedHourlyRate", event.target.value)} className="w-full rounded-r-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
                </div>
              </section>

              {submitError && <p className="text-sm text-red-700" role="alert">{submitError}</p>}
              <div className="border-t border-slate-200 pt-5">
                <p className="mb-4 text-xs leading-5 text-slate-500">Email verification is not available yet. Submitting records a pending application; it does not verify your email or grant Tutor access.</p>
                <button type="submit" disabled={submitting || subjectsLoading || Boolean(subjectsError) || subjects.length === 0} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">
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