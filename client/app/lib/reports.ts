export const REPORT_CATEGORIES = [
  "Technical issue",
  "Login or account problem",
  "Tutor application problem",
  "Payment problem",
  "Incorrect or inappropriate content",
  "Suspicious activity or safety concern",
  "Other"
] as const;

export const REPORT_STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface ReportRecord {
  id: number;
  category: ReportCategory;
  subject: string;
  description?: string;
  reporterRoles: string[];
  status: ReportStatus;
  response: string | null;
  createdAt: string;
  updatedAt: string;
  attachmentName: string | null;
  attachmentUrl: string | null;
  reporter?: {
    id: number;
    name: string;
    email: string;
    roles: string[];
  };
}
