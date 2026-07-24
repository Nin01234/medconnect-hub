import { z } from "zod";

export const LIMITS = {
  name: 200,
  email: 320,
  phone: 40,
  orgType: 80,
  shortText: 2000,
  longText: 12000,
  message: 8000,
  passwordMax: 128,
  passwordMin: 6,
  departments: 20,
  username: 30,
} as const;

const genderEnum = z.enum(["male", "female", "other"]);
const urgencyEnum = z.enum(["low", "medium", "high", "critical"]);

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must contain at least 3 characters")
  .max(LIMITS.username)
  .regex(/^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/, "Username can only use lowercase letters, numbers, dot, dash, and underscore");

export const authSignInSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(3, "Username or email must contain at least 3 characters").max(LIMITS.email),
  password: z.string().min(LIMITS.passwordMin, `Password must contain at least ${LIMITS.passwordMin} characters`).max(LIMITS.passwordMax),
}).superRefine((data, ctx) => {
  const isEmail = data.identifier.includes("@");
  if (isEmail) {
    const parsed = z.string().email().max(LIMITS.email).safeParse(data.identifier);
    if (!parsed.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid email" });
    }
    return;
  }
  const parsed = usernameSchema.safeParse(data.identifier);
  if (!parsed.success) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid username" });
  }
});

export const authSignUpSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(LIMITS.email),
  username: usernameSchema,
  password: z.string().min(LIMITS.passwordMin).max(LIMITS.passwordMax),
  fullName: z.string().trim().min(1).max(LIMITS.name),
  phone: z.string().trim().max(LIMITS.phone).optional().or(z.literal("")),
  orgName: z.string().trim().min(1).max(LIMITS.name),
  orgType: z.string().trim().min(1).max(LIMITS.orgType),
});

export const createReferralSchema = z.object({
  patient_name: z.string().trim().min(1).max(LIMITS.name),
  patient_age: z.preprocess((v) => {
    if (v === "" || v === undefined || v === null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().int().min(0).max(150).optional()),
  patient_gender: z.union([genderEnum, z.literal("")]).optional(),
  patient_phone: z.string().trim().max(LIMITS.phone).optional().or(z.literal("")),
  diagnosis: z.string().trim().min(1).max(LIMITS.longText),
  symptoms: z.string().trim().max(LIMITS.longText).optional().or(z.literal("")),
  vitals_bp: z.string().trim().max(50).optional().or(z.literal("")),
  vitals_hr: z.string().trim().max(50).optional().or(z.literal("")),
  vitals_temp: z.string().trim().max(50).optional().or(z.literal("")),
  vitals_rr: z.string().trim().max(50).optional().or(z.literal("")),
  vitals_spo2: z.string().trim().max(50).optional().or(z.literal("")),
  urgency_level: urgencyEnum,
  referral_reason: z.string().trim().min(1).max(LIMITS.longText),
  department_id: z.string().uuid(),
  notes: z.string().trim().max(LIMITS.longText).optional().or(z.literal("")),
});

export const referralMessageSchema = z.object({
  message: z.string().trim().min(1).max(LIMITS.message),
});

export const doctorCreateSchema = z.object({
  full_name: z.string().trim().min(1).max(LIMITS.name),
  specialty: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(LIMITS.phone).optional().or(z.literal("")),
  email: z.string().trim().max(LIMITS.email).optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  if (data.email && data.email.length > 0) {
    const r = z.string().email().safeParse(data.email);
    if (!r.success) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid email" });
  }
});

export const hospitalFeedbackSchema = z.object({
  rejection_reason: z.string().trim().min(1).max(LIMITS.longText).optional(),
  hospital_feedback: z.string().trim().min(1).max(LIMITS.longText).optional(),
});

const newOrgSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.name),
  type: z.string().trim().max(120).default("Other"),
  region: z.string().trim().max(120).default(""),
  city: z.string().trim().max(120).default(""),
  address: z.string().trim().max(500).default(""),
  gps_code: z.string().trim().max(80).default(""),
  contact: z.string().trim().max(LIMITS.phone).default(""),
  email: z.union([z.literal(""), z.string().trim().email().max(LIMITS.email)]).default(""),
  ownership_type: z.string().trim().max(80).optional(),
  departments: z.array(z.string().trim().max(80)).max(LIMITS.departments).optional(),
});

export const adminCreateUserSchema = z
  .object({
    full_name: z.string().trim().min(1).max(LIMITS.name),
    email: z.union([z.literal(""), z.string().trim().toLowerCase().email().max(LIMITS.email)]),
    username: usernameSchema,
    phone: z.string().trim().max(LIMITS.phone).optional().or(z.literal("")),
    password: z.string().min(LIMITS.passwordMin).max(LIMITS.passwordMax),
    role: z.enum(["clinic_user", "clinic_admin", "clinic_staff", "hospital_admin", "hospital_staff", "admin"]),
    status: z.enum(["pending_approval", "active", "rejected", "suspended"]),
    org_mode: z.enum(["existing", "new"]),
    clinic_id: z.union([z.string().uuid(), z.literal("")]),
    hospital_id: z.union([z.string().uuid(), z.literal("")]),
    department_id: z.union([z.string().uuid(), z.literal("")]).optional(),
    staff_id: z.string().trim().max(50).optional().or(z.literal("")),
    new_org: newOrgSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const needsOrg = data.role === "clinic_user" || data.role === "clinic_admin" || data.role === "clinic_staff" || data.role === "hospital_admin" || data.role === "hospital_staff";
    if (!needsOrg) return;
    if (data.org_mode === "existing") {
      // Only require clinic_id if there is no hospital_id — department staff/admins use hospital_id+department_id instead
      if ((data.role === "clinic_user" || data.role === "clinic_admin" || data.role === "clinic_staff") && !data.hospital_id && data.clinic_id === "") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a clinic", path: ["clinic_id"] });
      }
      if ((data.role === "hospital_admin" || data.role === "hospital_staff" || data.role === "clinic_admin" || data.role === "clinic_staff") && data.hospital_id === "" && !data.clinic_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a hospital", path: ["hospital_id"] });
      }
      // Require department only when hospital_id is provided (department-linked roles)
      if ((data.role === "hospital_staff" || data.role === "clinic_admin" || data.role === "clinic_staff") && data.hospital_id && (!data.department_id || data.department_id === "")) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a department", path: ["department_id"] });
      }
      if ((data.role === "hospital_staff" || data.role === "clinic_admin" || data.role === "clinic_staff") && data.hospital_id && (!data.staff_id || data.staff_id.trim() === "")) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Staff ID is required", path: ["staff_id"] });
      }
    }
    if (data.org_mode === "new") {
      const n = data.new_org?.name?.trim();
      if (!n) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Organization name is required", path: ["new_org", "name"] });
      }
    }
    if ((data.role === "hospital_admin" || data.role === "clinic_admin") && data.email.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Email is required for admin roles", path: ["email"] });
    }
  });

export const adminEditUserSchema = z
  .object({
    full_name: z.string().trim().min(1, "Full name is required").max(LIMITS.name),
    email: z.union([z.literal(""), z.string().trim().toLowerCase().email().max(LIMITS.email)]),
    username: usernameSchema,
    phone: z.string().trim().max(LIMITS.phone).optional().or(z.literal("")),
    role: z.enum(["clinic_user", "clinic_admin", "clinic_staff", "hospital_admin", "hospital_staff", "admin"]),
    status: z.enum(["pending_approval", "active", "rejected", "suspended"]),
    clinic_id: z.union([z.string().uuid(), z.literal("")]),
    hospital_id: z.union([z.string().uuid(), z.literal("")]),
    department_id: z.union([z.string().uuid(), z.literal("")]).optional(),
    staff_id: z.string().trim().max(50).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    // Only require clinic_id if there is no hospital_id — department staff/admins use hospital_id+department_id instead
    if ((data.role === "clinic_user" || data.role === "clinic_admin" || data.role === "clinic_staff") && !data.hospital_id && data.clinic_id === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a clinic", path: ["clinic_id"] });
    }
    if ((data.role === "hospital_admin" || data.role === "hospital_staff" || data.role === "clinic_admin" || data.role === "clinic_staff") && data.hospital_id === "" && !data.clinic_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a hospital", path: ["hospital_id"] });
    }
    // Require department only when hospital_id is provided (department-linked roles)
    if ((data.role === "hospital_staff" || data.role === "clinic_admin" || data.role === "clinic_staff") && data.hospital_id && (!data.department_id || data.department_id === "")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a department", path: ["department_id"] });
    }
    if ((data.role === "hospital_staff" || data.role === "clinic_admin" || data.role === "clinic_staff") && data.hospital_id && (!data.staff_id || data.staff_id.trim() === "")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Staff ID is required", path: ["staff_id"] });
    }
  });

export const resetPasswordSchema = z.object({
  new_password: z.string().min(LIMITS.passwordMin).max(LIMITS.passwordMax),
});
