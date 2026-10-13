function getDashboardPath(roles) {
  if (!Array.isArray(roles)) return null;
  if (roles.includes("ADMIN")) return "/dashboard/admin";
  if (roles.includes("TUTOR")) return "/dashboard/tutor";
  if (roles.includes("STUDENT")) return "/dashboard/student";
  return null;
}

function getHomeRouteDecision(responseStatus, roles) {
  if (responseStatus === 401) return { kind: "public" };
  if (responseStatus < 200 || responseStatus >= 300) return { kind: "error" };
  const href = getDashboardPath(roles);
  return href ? { kind: "redirect", href } : { kind: "error" };
}

function getTutorApplicationStatusLabel(status) {
  if (status === "PENDING") return "Pending";
  if (status === "APPROVED" || status === "ACCEPTED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  return null;
}

module.exports = { getDashboardPath, getHomeRouteDecision, getTutorApplicationStatusLabel };
