import assert from "node:assert/strict";
import { test } from "node:test";
import dashboardRouting from "../app/lib/dashboardRouting.js";

const {
  getDashboardPath,
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

test("application status labels preserve approved legacy values and unknown statuses", () => {
  assert.equal(getTutorApplicationStatusLabel("PENDING"), "Pending");
  assert.equal(getTutorApplicationStatusLabel("APPROVED"), "Approved");
  assert.equal(getTutorApplicationStatusLabel("ACCEPTED"), "Approved");
  assert.equal(getTutorApplicationStatusLabel("REJECTED"), "Rejected");
  assert.equal(getTutorApplicationStatusLabel(""), null);
  assert.equal(getTutorApplicationStatusLabel(undefined), null);
});
