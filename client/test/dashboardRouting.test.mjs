import assert from "node:assert/strict";
import { test } from "node:test";
import dashboardRouting from "../app/lib/dashboardRouting.js";

const {
  getDashboardPath,
  getHomeRouteDecision,
  getTutorApplicationStatusLabel
} = dashboardRouting;

test("dashboard destination follows the user's authorized roles", () => {
  assert.equal(getDashboardPath(["STUDENT"]), "/dashboard/student");
  assert.equal(getDashboardPath(["TUTOR"]), "/dashboard/tutor");
  assert.equal(getDashboardPath(["ADMIN"]), "/dashboard/admin");
  assert.equal(getDashboardPath(["STUDENT", "TUTOR"]), "/dashboard/tutor");
  assert.equal(getDashboardPath(["ADMIN", "STUDENT", "TUTOR"]), "/dashboard/admin");
  assert.equal(getDashboardPath([]), null);
  assert.equal(getDashboardPath(null), null);
});

test("public home access is allowed only for logged-out users", () => {
  assert.deepEqual(getHomeRouteDecision(401, ["STUDENT"]), { kind: "public" });
  assert.deepEqual(getHomeRouteDecision(200, ["STUDENT"]), {
    kind: "redirect",
    href: "/dashboard/student"
  });
  assert.deepEqual(getHomeRouteDecision(200, ["TUTOR"]), {
    kind: "redirect",
    href: "/dashboard/tutor"
  });
  assert.deepEqual(getHomeRouteDecision(200, ["ADMIN"]), {
    kind: "redirect",
    href: "/dashboard/admin"
  });
  assert.deepEqual(getHomeRouteDecision(200, []), { kind: "error" });
  assert.deepEqual(getHomeRouteDecision(503, ["STUDENT"]), { kind: "error" });
});

test("application status labels preserve approved legacy values and unknown statuses", () => {
  assert.equal(getTutorApplicationStatusLabel("PENDING"), "Pending");
  assert.equal(getTutorApplicationStatusLabel("APPROVED"), "Approved");
  assert.equal(getTutorApplicationStatusLabel("ACCEPTED"), "Approved");
  assert.equal(getTutorApplicationStatusLabel("REJECTED"), "Rejected");
  assert.equal(getTutorApplicationStatusLabel(""), null);
  assert.equal(getTutorApplicationStatusLabel(undefined), null);
});
