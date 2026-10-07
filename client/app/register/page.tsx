"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import universityConfig from "../../config/universities.json";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const universities = universityConfig.universities;

function getSelectedUniversity(code: string) {
  return universities.find((university) => university.code === code);
}

function validateUniversityEmail(email: string, universityCode: string) {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) return "";

  const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailFormat.test(trimmedEmail)) {
    return "Please enter a valid email address.";
  }

  const university = getSelectedUniversity(universityCode);
  if (!university) {
    return "Select a supported university before entering your student email.";
  }

  if (!university.emailVerificationConfigured || !university.studentEmailRegex) {
    return `The official ${university.code} student email format has not been verified yet.`;
  }

  const emailDomain = trimmedEmail.split("@")[1]?.toLowerCase();
  if (!university.studentEmailDomains.includes(emailDomain || "")) {
    const belongsToAnotherUniversity = universities.some((otherUniversity) =>
      {
        const otherDomains: string[] = otherUniversity.studentEmailDomains;
        return otherUniversity.code !== university.code
          && otherUniversity.emailVerificationConfigured
          && otherDomains.includes(emailDomain || "");
      });
    return belongsToAnotherUniversity
      ? "This email address does not match the selected university."
      : `Please use your official ${university.code} student email address.`;
  }

  if (!new RegExp(university.studentEmailRegex, "i").test(trimmedEmail)) {
    return "This email address does not match the selected university.";
  }

  return "";
}

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [universityCode, setUniversityCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedUniversity = getSelectedUniversity(universityCode);
  const emailError = useMemo(() => validateUniversityEmail(email, universityCode), [email, universityCode]);
  const universityDomainHint = useMemo(() => {
    if (!selectedUniversity) return "Select a university to see its student email format.";
    if (!selectedUniversity.emailVerificationConfigured) {
      return `The official student email format for ${selectedUniversity.code} is not verified yet.`;
    }
    return `Use your ${selectedUniversity.code} student email, for example ${selectedUniversity.example}.`;
  }, [selectedUniversity]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!firstName.trim() || !lastName.trim() || !universityCode || !email.trim() || !password) {
      setErrorMessage("Please fill out all required fields.");
      return;
    }

    if (emailError) {
      setErrorMessage(emailError);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    const tutorIntent = new URLSearchParams(window.location.search).get("intent") === "tutor";

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          university: universityCode,
          email: email.trim(),
          password,
          role: "STUDENT"
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Registration failed.");
        setLoading(false);
        return;
      }

      setSuccessMessage(tutorIntent
        ? "Account created. Continuing to your tutor application..."
        : "Registration successful! Redirecting to login...");
      setTimeout(() => {
        router.push(tutorIntent ? "/tutor/application" : "/login");
      }, 1500);
    } catch (err) {
      console.error("Register network error:", err);
      setErrorMessage(`Unable to connect to backend server at ${API_BASE_URL}. Please ensure the Express server is running ('npm start' in server folder).`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F3EEFF] to-[#FFF0E8] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-[#CFC4F8] bg-white/70 shadow-lg backdrop-blur-sm">
        <div className="grid min-h-[840px] lg:grid-cols-2">
          {/* LEFT SIDE: Vibrant purple gradient */}
          <div
            className="flex items-center justify-center px-6 py-12 text-white md:px-10"
            style={{ background: "linear-gradient(135deg, #6C4CF1 0%, #8B5CF6 100%)" }}
          >
            <div className="max-w-md">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFD166] text-lg font-black text-[#241B3B] shadow-sm">
                  E
                </div>
                <span className="text-2xl font-bold tracking-tight text-white">EasyLearning</span>
              </div>

              <h1 className="mt-10 text-4xl font-bold tracking-tight text-white">Create your account</h1>
              <p className="mt-4 text-base text-[#EDE7FF]">
                Join a supportive community of students learning, teaching, and growing together.
              </p>

              <div
                className="mt-10 rounded-2xl border border-white/20 p-5 shadow-sm"
                style={{ background: "rgba(255, 255, 255, 0.12)" }}
              >
                <p className="text-sm font-medium text-[#EDE7FF]">You can join as</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div
                    className="rounded-xl border border-white/20 p-3"
                    style={{ background: "rgba(255, 255, 255, 0.15)" }}
                  >
                    <p className="font-semibold text-white">Student</p>
                    <p className="mt-1 text-xs text-[#EDE7FF]">Find tutors and book support.</p>
                  </div>
                  <div
                    className="rounded-xl border border-white/20 p-3"
                    style={{ background: "rgba(255, 255, 255, 0.15)" }}
                  >
                    <p className="font-semibold text-white">Tutor applicant</p>
                    <p className="mt-1 text-xs text-[#EDE7FF]">Apply for tutor access after creating a student account.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Soft peach to lavender gradient */}
          <div
            className="flex items-center justify-center px-6 py-10 md:px-10"
            style={{ background: "linear-gradient(135deg, #FFE8DD 0%, #EDE7FF 100%)" }}
          >
            <div className="w-full max-w-md">
              <div className="mb-8">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#6C4CF1]">Register</p>
                <h2 className="mt-2 text-3xl font-bold text-[#241B3B]">Join EasyLearning</h2>
              </div>

              {errorMessage && (
                <div className="mb-6 rounded-xl border border-[#EF4444] bg-[#EF4444]/10 p-4 text-sm font-medium text-[#EF4444]">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="mb-6 rounded-xl border border-[#22C55E] bg-[#22C55E]/10 p-4 text-sm font-medium text-[#22C55E]">
                  {successMessage}
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-[#241B3B]">
                      First Name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First Name"
                      style={{ background: "rgba(255, 255, 255, 0.55)" }}
                      className="w-full rounded-xl border border-[#CFC4F8] px-4 py-3 text-[#241B3B] placeholder-[#625B71] outline-none transition focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30 focus:bg-white"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label htmlFor="lastName" className="mb-2 block text-sm font-medium text-[#241B3B]">
                      Last Name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last Name"
                      style={{ background: "rgba(255, 255, 255, 0.55)" }}
                      className="w-full rounded-xl border border-[#CFC4F8] px-4 py-3 text-[#241B3B] placeholder-[#625B71] outline-none transition focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30 focus:bg-white"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="university" className="mb-2 block text-sm font-medium text-[#241B3B]">
                    University
                  </label>
                  <select
                    id="university"
                    value={universityCode}
                    onChange={(event) => setUniversityCode(event.target.value)}
                    style={{ background: "rgba(255, 255, 255, 0.55)" }}
                    className="w-full rounded-xl border border-[#CFC4F8] px-4 py-3 text-[#241B3B] outline-none transition focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30 focus:bg-white"
                    disabled={loading}
                    required
                  >
                    <option value="" disabled>Select your university</option>
                    {universities.map((university) => (
                      <option key={university.code} value={university.code}>
                        {university.name} ({university.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-[#241B3B]">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={selectedUniversity?.example || "Select a university first"}
                    style={{ background: "rgba(255, 255, 255, 0.55)" }}
                    className={`w-full rounded-xl border px-4 py-3 text-[#241B3B] placeholder-[#625B71] outline-none transition focus:ring-2 focus:ring-[#6C4CF1]/30 focus:bg-white ${
                      emailError ? "border-[#EF4444] bg-[#EF4444]/10 focus:border-[#EF4444]" : "border-[#CFC4F8] focus:border-[#6C4CF1]"
                    }`}
                    disabled={loading}
                  />
                  <p className="mt-2 text-xs text-[#625B71]">{universityDomainHint}</p>
                  {emailError ? <p className="mt-2 text-xs font-medium text-[#EF4444]">{emailError}</p> : null}
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-[#241B3B]">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      style={{ background: "rgba(255, 255, 255, 0.55)" }}
                      className="w-full rounded-xl border border-[#CFC4F8] px-4 py-3 pr-11 text-[#241B3B] placeholder-[#625B71] outline-none transition focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30 focus:bg-white"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute inset-y-0 right-3 flex items-center text-sm font-medium text-[#625B71] hover:text-[#241B3B]"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-[#241B3B]">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      style={{ background: "rgba(255, 255, 255, 0.55)" }}
                      className="w-full rounded-xl border border-[#CFC4F8] px-4 py-3 pr-11 text-[#241B3B] placeholder-[#625B71] outline-none transition focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30 focus:bg-white"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className="absolute inset-y-0 right-3 flex items-center text-sm font-medium text-[#625B71] hover:text-[#241B3B]"
                    >
                      {showConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-[#241B3B]">Student account</p>
                  <p className="mt-1 text-xs leading-5 text-[#625B71]">
                    Every account starts as a student. Apply separately to tutor after creating your account.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: loading ? "#8B5CF6" : "linear-gradient(90deg, #6C4CF1, #8B5CF6)",
                  }}
                  className="w-full rounded-xl px-4 py-3 font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-50"
                >
                  {loading ? "Creating Account..." : "Create Account"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-[#625B71]">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-[#6C4CF1] hover:text-[#8B5CF6]">
                  Login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
