/** Stable TanStack Query keys + prefixes for Supabase realtime invalidation. */

export const referralKeys = {
  all: ["referrals"] as const,
  /** Invalidate all hospital-scoped referral lists (dashboard + inbox) for one hospital. */
  hospitalRoot: (hospitalId: string) => [...referralKeys.all, "hospital", hospitalId] as const,
  hospitalDashboard: (hospitalId: string) => [...referralKeys.hospitalRoot(hospitalId), "dashboard"] as const,
  hospitalInbox: (hospitalId: string) => [...referralKeys.hospitalRoot(hospitalId), "inbox"] as const,
  hospitalAssigned: (hospitalId: string) => [...referralKeys.hospitalRoot(hospitalId), "assigned"] as const,
  /** Clinic dashboard list. */
  clinicRoot: (clinicId: string) => [...referralKeys.all, "clinic", clinicId] as const,
  clinicDashboard: (clinicId: string) => [...referralKeys.clinicRoot(clinicId), "dashboard"] as const,
  clinicMyReferrals: (clinicId: string) => [...referralKeys.clinicRoot(clinicId), "my-referrals"] as const,
};
