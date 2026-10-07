const { universities } = require("../client/config/universities.json");

const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getUniversity(value) {
  if (typeof value !== "string") return null;
  const normalizedValue = value.trim().toLowerCase();
  return universities.find((university) => university.code.toLowerCase() === normalizedValue
    || university.name.toLowerCase() === normalizedValue) || null;
}

function validateStudentEmail(universityValue, emailValue) {
  const university = getUniversity(universityValue);
  if (!university) {
    return { university: null, error: "Select a supported university." };
  }

  if (typeof emailValue !== "string" || !basicEmailPattern.test(emailValue.trim())) {
    return { university, error: "Enter a valid university email address." };
  }

  if (!university.emailVerificationConfigured || !university.studentEmailRegex) {
    return {
      university,
      error: `Official student email validation is not configured for ${university.code} yet.`
    };
  }

  const normalizedEmail = emailValue.trim().toLowerCase();
  const emailDomain = normalizedEmail.split("@")[1];
  if (!university.studentEmailDomains.includes(emailDomain)) {
    const belongsToAnotherUniversity = universities.some((otherUniversity) =>
      otherUniversity.code !== university.code
      && otherUniversity.emailVerificationConfigured
      && otherUniversity.studentEmailDomains.includes(emailDomain));
    return {
      university,
      error: belongsToAnotherUniversity
        ? "This email address does not match the selected university."
        : "Please use your official university student email address."
    };
  }

  if (!new RegExp(university.studentEmailRegex, "i").test(normalizedEmail)) {
    return {
      university,
      error: "This email address does not match the selected university."
    };
  }

  return { university, error: "" };
}

module.exports = { getUniversity, validateStudentEmail };