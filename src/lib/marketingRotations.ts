import type { LucideIcon } from "lucide-react";
import { Hospital, ShieldCheck, Stethoscope, Users, UserCheck, Radio, Lock, ClipboardList } from "lucide-react";

export type Accent = "primary" | "accent";

export type HeroRotation = {
  line1Before: string;
  line1Highlight: string;
  line1Accent: Accent;
  line2Before: string;
  line2Highlight: string;
  line2Accent: Accent;
};

/** Hero lines — swap on a timer across the landing and auth panels */
export const HERO_ROTATIONS: HeroRotation[] = [
  {
    line1Before: "Refer patients with ",
    line1Highlight: "clarity.",
    line1Accent: "primary",
    line2Before: "Treat them with ",
    line2Highlight: "speed.",
    line2Accent: "accent",
  },
  {
    line1Before: "Care coordination ",
    line1Highlight: "made simple.",
    line1Accent: "primary",
    line2Before: "Referrals, responses, and teams in ",
    line2Highlight: "one secure place.",
    line2Accent: "accent",
  },
  {
    line1Before: "From clinic to hospital with ",
    line1Highlight: "clarity.",
    line1Accent: "primary",
    line2Before: "Track every step with ",
    line2Highlight: "confidence.",
    line2Accent: "accent",
  },
  {
    line1Before: "Built for ",
    line1Highlight: "MedReferal",
    line1Accent: "primary",
    line2Before: "Serving patients and staff with ",
    line2Highlight: "discipline & care.",
    line2Accent: "accent",
  },
];

export const SUBTEXT_ROTATIONS: string[] = [
  "Manage referrals, track hospital responses, and keep your team aligned in one secure place.",
  "Structured, real-time referral workflow for Ghana Military Service Hospital & Clinic and partner sites.",
  "Role-based access, admin-managed account approvals, and audit-friendly records for military health operations.",
  "From peripheral clinics to the main hospital — one pipeline for referrals, messages, and outcomes.",
];

export type StatTriple = { n: string; l: string };

export const STAT_ROTATIONS: [StatTriple, StatTriple, StatTriple][] = [
  [
    { n: "< 1 min", l: "To submit referral" },
    { n: "Real-time", l: "Status updates" },
    { n: "RLS", l: "Secure by design" },
  ],
  [
    { n: "Role-based", l: "Secure access" },
    { n: "Admin OK", l: "For new accounts" },
    { n: "Encrypted", l: "In transit & at rest" },
  ],
  [
    { n: "One hub", l: "All referrals" },
    { n: "Tracked", l: "Hospital responses" },
    { n: "Aligned", l: "Clinical teams" },
  ],
];

export type FeatureCardDef = {
  icon: LucideIcon;
  title: string;
  desc: string;
  accent: "primary" | "gold";
};

/** Feature grid — entire card set swaps so messaging feels alive */
export const FEATURE_SLIDES: FeatureCardDef[][] = [
  [
    { icon: Hospital, title: "Hospital Inbox", desc: "Triaged, filterable, real-time.", accent: "primary" },
    { icon: Stethoscope, title: "Clinic Portal", desc: "Structured referrals in a guided form.", accent: "gold" },
    { icon: Users, title: "Doctor Assignment", desc: "Inside the Hospital Portal.", accent: "primary" },
    { icon: ShieldCheck, title: "RBAC + row security", desc: "Each user only sees their data.", accent: "gold" },
  ],
  [
    { icon: ShieldCheck, title: "Role-based secure access", desc: "Hospital, clinic, and admin views — least privilege by design.", accent: "primary" },
    { icon: UserCheck, title: "Admin account activation", desc: "New accounts stay pending until an administrator activates them.", accent: "gold" },
    { icon: Radio, title: "Live status & messages", desc: "Referrals and threads update without refreshing the page.", accent: "primary" },
    { icon: ClipboardList, title: "Traceable handoffs", desc: "Accept, assign, complete — clear history for every case.", accent: "gold" },
  ],
  [
    { icon: Lock, title: "Secure by design", desc: "Authentication, authorization, and data boundaries enforced in the database.", accent: "primary" },
    { icon: Stethoscope, title: "Patient-centred flow", desc: "Clinical detail, urgency, and attachments stay with the referral.", accent: "gold" },
    { icon: Hospital, title: "Hospital visibility", desc: "See what is new, high priority, or awaiting action at a glance.", accent: "primary" },
    { icon: Users, title: "Team alignment", desc: "Clinic and hospital staff work from the same structured record.", accent: "gold" },
  ],
];

/** Smaller tagline above hero on landing */
export const BADGE_ROTATIONS: string[] = [
  "Ghana Military Service Hospital & Clinic",
  "Care coordination · secure referrals",
  "Built for military health operations",
  "Real-time · role-based · admin-gated access",
];

/** Auth panel bullet pairs (two lines) — rotate with headline */
export const AUTH_BULLET_ROTATIONS: [string, string][] = [
  ["Role-based secure access", "Admin approval for new accounts"],
  ["Encrypted sign-in & sessions", "Least-privilege data access"],
  ["Audit-friendly activity trails", "Structured referral documents"],
  ["Hospital & clinic portals", "Aligned teams, one pipeline"],
];
