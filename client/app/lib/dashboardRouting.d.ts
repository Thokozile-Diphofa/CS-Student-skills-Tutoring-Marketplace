export function getDashboardPath(roles: readonly string[] | null | undefined): string | null;
export function getHomeRouteDecision(
  responseStatus: number,
  roles: readonly string[] | null | undefined
): { kind: "public" } | { kind: "redirect"; href: string } | { kind: "error" };
export function getTutorApplicationStatusLabel(status: string | null | undefined): string | null;
