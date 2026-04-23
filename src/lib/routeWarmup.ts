let didWarmPortalBundles = false;

export function warmPortalBundles(): void {
  if (didWarmPortalBundles) return;
  didWarmPortalBundles = true;
  void Promise.allSettled([
    import("@/pages/PortalRouter"),
    import("@/layouts/ClinicLayout"),
    import("@/layouts/HospitalLayout"),
    import("@/layouts/AdminLayout"),
  ]);
}

export function warmAuthAndPortalBundles(): void {
  warmPortalBundles();
  void import("@/pages/Auth");
}
