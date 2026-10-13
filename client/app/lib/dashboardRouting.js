function getDashboardPath(roles) {
  if (!Array.isArray(roles)) return null;
  if (roles.includes("ADMIN")) return "/dashboard/admin";
  if (roles.includes("TUTOR")) return "/dashboard/tutor";
  if (roles.includes("STUDENT")) return "/dashboard/student";
  return null;
}

function getTutorApplicationStatusLabel(status) {
  if (status === "PENDING") return "Pending";
  if (status === "APPROVED" || status === "ACCEPTED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  return null;
}

module.exports = { getDashboardPath, getTutorApplicationStatusLabel };
