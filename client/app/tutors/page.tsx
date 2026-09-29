"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

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

const SUBJECT_OPTIONS = ["All", "Computer Science", "Mathematics", "Data Structures", "Statistics", "Physics"];
const UNIVERSITY_OPTIONS = ["All", "TUT", "Wits", "UCT", "Stellenbosch", "UP"];

export default function TutorsSearchPage() {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [selectedUniversity, setSelectedUniversity] = useState("All");

  const fetchTutors = async () => {
    setLoading(true);
    setError("");

    try {
      const queryParams = new URLSearchParams();
      if (searchTerm.trim()) queryParams.append("search", searchTerm.trim());
      if (selectedSubject !== "All") queryParams.append("subject", selectedSubject);
      if (selectedUniversity !== "All") queryParams.append("university", selectedUniversity);

      const response = await fetch(`${API_BASE_URL}/api/tutors?${queryParams.toString()}`, {
        method: "GET",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Failed to load tutors from database.");
      }

      const data = await response.json();
      setTutors(data.tutors || []);
    } catch (err: any) {
      console.error("Error fetching tutors:", err);
      setError("Unable to retrieve tutor listings. Please check backend connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTutors();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedSubject, selectedUniversity]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <div>
        <Navbar />

        <main className="mx-auto max-w-7xl px-6 py-10 md:px-10">
          <div className="mb-10 text-center md:text-left">
            <span className="inline-flex rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700">
              Find Peer Support
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Discover CS & Math Student Tutors
            </h1>
            <p className="mt-2 text-slate-600">
              Connect with verified student tutors from your university based on subjects and hourly rates.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-1">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Search Tutor or Keyword
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="e.g. Computer Science, Calculus, Thabo..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Filter By Subject
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white"
                >
                  {SUBJECT_OPTIONS.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub === "All" ? "All Subjects" : sub}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Filter By University
                </label>
                <select
                  value={selectedUniversity}
                  onChange={(e) => setSelectedUniversity(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white"
                >
                  {UNIVERSITY_OPTIONS.map((uni) => (
                    <option key={uni} value={uni}>
                      {uni === "All" ? "All Universities" : uni}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subject Filter Pills */}
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <span className="text-xs font-semibold text-slate-500 mr-2">Popular:</span>
              {SUBJECT_OPTIONS.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubject(sub)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    selectedSubject === sub
                      ? "bg-amber-400 text-slate-950 font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="h-10 w-10 rounded-full bg-slate-200"></div>
                  <div className="mt-4 h-5 w-3/4 rounded bg-slate-200"></div>
                  <div className="mt-2 h-4 w-1/2 rounded bg-slate-200"></div>
                  <div className="mt-6 h-10 w-full rounded-xl bg-slate-200"></div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && tutors.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-xl">
                🔍
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">No tutors found</h3>
              <p className="mt-1 text-sm text-slate-600">
                We couldn't find any peer tutors matching your search or filters.
              </p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedSubject("All");
                  setSelectedUniversity("All");
                }}
                className="mt-5 rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* Tutor Cards Grid */}
          {!loading && !error && tutors.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tutors.map((tutor) => (
                <div
                  key={tutor.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-slate-300"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 font-black text-slate-950 text-lg">
                        {tutor.firstName[0]}
                        {tutor.lastName[0]}
                      </div>
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                        VERIFIED PEER TUTOR
                      </span>
                    </div>

                    <div className="mt-4">
                      <h2 className="text-xl font-bold text-slate-900">
                        {tutor.firstName} {tutor.lastName}
                      </h2>
                      <p className="text-xs font-semibold text-slate-500">{tutor.university}</p>
                    </div>

                    <p className="mt-3 text-xs font-semibold text-slate-700 line-clamp-2">
                      {tutor.headline}
                    </p>

                    {/* Hourly Rate Display */}
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-xs text-slate-500 font-medium">Hourly Rate:</span>
                      <span className="text-lg font-extrabold text-amber-600">
                        R{tutor.hourlyRate.toFixed(0)} <span className="text-xs font-normal text-slate-500">/ hour</span>
                      </span>
                    </div>

                    {/* Subjects Badges */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tutor.subjects.map((sub) => (
                        <span
                          key={sub}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                        >
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-100 pt-4">
                    <Link
                      href={`/tutors/${tutor.id}`}
                      className="block w-full rounded-xl bg-amber-400 py-2.5 text-center text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
