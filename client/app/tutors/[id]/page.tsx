"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Tutor {
  id: number;
  firstName: string;
  lastName: string;
  university: string;
  email: string;
  headline: string;
  bio: string;
  hourlyRate: number;
  subjects: string[];
  roles: string[];
}

export default function TutorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const tutorId = resolvedParams.id;

  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [hasStudentRole, setHasStudentRole] = useState(false);
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [message, setMessage] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState("");
  const [requestError, setRequestError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchTutorProfile() {
      setLoading(true);
      setError("");

      try {
        const [response, authResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/tutors/${tutorId}`, {
            method: "GET",
            credentials: "include"
          }),
          fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" }).catch(() => null)
        ]);

        if (authResponse?.ok) {
          const authData = await authResponse.json();
          const currentUser = authData.user;
          setStudentId(typeof currentUser?.id === "number" ? currentUser.id : null);
          setHasStudentRole(Array.isArray(currentUser?.roles) && currentUser.roles.includes("STUDENT"));
        }

        if (response.status === 404) {
          setError("Tutor profile not found or user is not a tutor.");
          setLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load tutor profile.");
        }

        const data = await response.json();
        setTutor(data.tutor || null);
      } catch (error: unknown) {
        console.error("Error fetching tutor profile:", error);
        setError("Unable to connect to server. Please check backend connection.");
      } finally {
        setLoading(false);
      }
    }

    if (tutorId) {
      fetchTutorProfile();
    }
  }, [tutorId]);

  async function openRequestForm() {
    setRequestError("");
    setRequestSuccess("");
    if (!studentId) {
      router.push(`/login?next=${encodeURIComponent(`/tutors/${tutorId}`)}`);
      return;
    }
    if (!hasStudentRole) {
      setRequestError("A student account is required to request a session.");
      return;
    }
    if (Number(studentId) === Number(tutor?.id)) {
      setRequestError("You cannot request a session with yourself.");
      return;
    }
    setRequestFormOpen(true);
  }

  async function submitSessionRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError("");
    setRequestSuccess("");
    if (!tutor) return;
    if (!subject.trim()) {
      setRequestError("Enter a subject or module.");
      return;
    }
    setRequesting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/session-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tutorId: tutor.id,
          subject: subject.trim(),
          requestedDate: requestedDate ? new Date(requestedDate).toISOString() : null,
          message: message.trim() || null
        })
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/tutors/${tutorId}`)}`);
        return;
      }
      if (!response.ok) throw new Error(data.error || "Unable to send the session request.");
      setRequestFormOpen(false);
      setSubject("");
      setRequestedDate("");
      setMessage("");
      setRequestSuccess("Session request sent successfully.");
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Unable to send the session request.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F3EEFF] to-[#FFF0E8] text-[#241B3B] flex flex-col justify-between">
      <div>
        <Navbar />

        <main className="mx-auto max-w-5xl px-6 py-10 md:px-10">
          <div className="mb-6">
            <Link
              href="/tutors"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#6C4CF1] hover:text-[#8B5CF6] transition"
            >
              ← Back to Tutor Search
            </Link>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="animate-pulse rounded-2xl border border-[#CFC4F8] bg-white/80 p-8 shadow-sm">
              <div className="h-16 w-16 rounded-full bg-[#EDE7FF]"></div>
              <div className="mt-4 h-6 w-1/3 rounded bg-[#EDE7FF]"></div>
              <div className="mt-2 h-4 w-1/4 rounded bg-[#EDE7FF]"></div>
              <div className="mt-8 h-20 w-full rounded bg-[#EDE7FF]"></div>
            </div>
          )}

          {/* Error / 404 State */}
          {error && !loading && (
            <div className="rounded-2xl border border-[#EF4444] bg-[#EF4444]/10 p-8 text-center backdrop-blur-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EF4444]/20 text-[#EF4444] font-bold text-xl">
                ⚠️
              </div>
              <h2 className="mt-4 text-lg font-bold text-[#241B3B]">Profile Not Found</h2>
              <p className="mt-1 text-sm text-[#EF4444]">{error}</p>
              <Link
                href="/tutors"
                className="mt-6 inline-flex rounded-full bg-[#241B3B] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#6C4CF1] transition"
              >
                Return to Tutors List
              </Link>
            </div>
          )}

          {/* Profile Loaded */}
          {!loading && !error && tutor && (
            <div className="grid gap-8 md:grid-cols-3">
              {/* Left Column Profile Card */}
              <div className="md:col-span-2 space-y-6">
                <div className="rounded-2xl border border-[#CFC4F8] bg-white/80 p-8 shadow-sm backdrop-blur-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#CFC4F8]/40 pb-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFD166] font-black text-[#241B3B] text-2xl shadow-sm">
                        {tutor.firstName[0]}
                        {tutor.lastName[0]}
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold text-[#241B3B]">
                          {tutor.firstName} {tutor.lastName}
                        </h1>
                        <p className="text-sm font-semibold text-[#625B71]">{tutor.university}</p>
                      </div>
                    </div>

                    <span className="inline-self-start rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 px-3 py-1 text-xs font-bold text-[#22C55E] uppercase tracking-wider">
                      VERIFIED PEER TUTOR
                    </span>
                  </div>

                  <div className="mt-6">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6C4CF1]">Headline</h2>
                    <p className="mt-1 text-base font-semibold text-[#241B3B]">{tutor.headline}</p>
                  </div>

                  <div className="mt-6">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6C4CF1]">About Me</h2>
                    <p className="mt-2 text-sm leading-relaxed text-[#241B3B] whitespace-pre-line">{tutor.bio}</p>
                  </div>

                  <div className="mt-6 border-t border-[#CFC4F8]/40 pt-6">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6C4CF1]">Subjects Taught</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tutor.subjects.map((sub) => (
                        <span
                          key={sub}
                          className="rounded-lg bg-[#EDE7FF] border border-[#6C4CF1]/30 px-3 py-1 text-xs font-semibold text-[#6C4CF1]"
                        >
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column Booking Card Placeholder */}
              <div className="md:col-span-1">
                <div className="sticky top-6 rounded-2xl border border-[#CFC4F8] bg-white/80 p-6 shadow-sm backdrop-blur-sm">
                  <div className="border-b border-[#CFC4F8]/40 pb-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#625B71]">Rate & Pricing</p>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-[#6C4CF1]">R{tutor.hourlyRate.toFixed(0)}</span>
                      <span className="text-sm font-normal text-[#625B71]">/ hour</span>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4 text-xs text-[#625B71]">
                    <div className="flex justify-between border-b border-[#CFC4F8]/40 pb-2">
                      <span>University:</span>
                      <strong className="text-[#241B3B]">{tutor.university}</strong>
                    </div>
                    <div className="flex justify-between border-b border-[#CFC4F8]/40 pb-2">
                      <span>Status:</span>
                      <strong className="text-[#22C55E]">Active Peer Tutor</strong>
                    </div>
                    <div className="flex justify-between border-b border-[#CFC4F8]/40 pb-2">
                      <span>Sessions:</span>
                      <strong className="text-[#241B3B]">1-on-1 Peer Tutoring</strong>
                    </div>
                  </div>

                  <div className="mt-8">
                    <button
                      type="button"
                      onClick={() => void openRequestForm()}
                      disabled={Number(studentId) === Number(tutor.id)}
                      className="w-full rounded-xl bg-[#6C4CF1] py-3 text-sm font-semibold text-white transition hover:bg-[#5B3FE0] disabled:cursor-not-allowed disabled:bg-[#CFC4F8]/50 disabled:text-[#625B71]"
                    >
                      Request Session
                    </button>
                    {Number(studentId) === Number(tutor.id) && <p className="mt-2 text-xs text-[#625B71]">You cannot request a session with yourself.</p>}
                    {requestSuccess && <p className="mt-3 text-sm font-medium text-[#15803D]" role="status">{requestSuccess}</p>}
                    {requestError && <p className="mt-3 text-sm font-medium text-[#EF4444]" role="alert">{requestError}</p>}
                    {requestFormOpen && (
                      <form onSubmit={submitSessionRequest} className="mt-4 space-y-3 border-t border-[#CFC4F8]/50 pt-4">
                        <div>
                          <label htmlFor="request-subject" className="mb-1 block text-xs font-semibold text-[#241B3B]">Subject or module</label>
                          <input
                            id="request-subject"
                            list="tutor-subject-options"
                            required
                            maxLength={200}
                            value={subject}
                            onChange={(event) => setSubject(event.target.value)}
                            className="w-full rounded-lg border border-[#CFC4F8] bg-white px-3 py-2 text-sm outline-none focus:border-[#6C4CF1]"
                          />
                          <datalist id="tutor-subject-options">
                            {tutor.subjects.map((tutorSubject) => <option key={tutorSubject} value={tutorSubject} />)}
                          </datalist>
                        </div>
                        <div>
                          <label htmlFor="request-date" className="mb-1 block text-xs font-semibold text-[#241B3B]">Requested date and time <span className="font-normal text-[#625B71]">(optional)</span></label>
                          <input
                            id="request-date"
                            type="datetime-local"
                            value={requestedDate}
                            onChange={(event) => setRequestedDate(event.target.value)}
                            className="w-full rounded-lg border border-[#CFC4F8] bg-white px-3 py-2 text-sm outline-none focus:border-[#6C4CF1]"
                          />
                        </div>
                        <div>
                          <label htmlFor="request-message" className="mb-1 block text-xs font-semibold text-[#241B3B]">Message <span className="font-normal text-[#625B71]">(optional)</span></label>
                          <textarea
                            id="request-message"
                            rows={3}
                            maxLength={3000}
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                            className="w-full resize-y rounded-lg border border-[#CFC4F8] bg-white px-3 py-2 text-sm outline-none focus:border-[#6C4CF1]"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={requesting}
                          className="w-full rounded-lg bg-[#241B3B] py-2.5 text-sm font-semibold text-white transition hover:bg-[#3B3155] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {requesting ? "Sending request..." : "Send Session Request"}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
