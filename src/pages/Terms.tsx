import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <header className="container py-5 flex items-center justify-between border-b">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <Link to="/auth">
          <Button variant="outlineBrand" size="sm">
            Sign in
          </Button>
        </Link>
      </header>

      <main className="container max-w-3xl py-12 prose prose-neutral dark:prose-invert prose-headings:font-display">
        <h1 className="text-3xl font-bold font-display">Terms &amp; Conditions</h1>
        <p className="text-muted-foreground text-sm not-prose mt-2">
          {BRAND.institution} — Referral coordination platform. Last updated {new Date().getFullYear()}.
        </p>

        <h2>1. Acceptance</h2>
        <p>
          By accessing or using this application, you agree to these Terms on behalf of yourself and, where applicable, your organisation. If you do not agree, do not use the service.
        </p>

        <h2>2. Purpose</h2>
        <p>
          The platform is provided to support clinical referral coordination, messaging related to referrals, and administrative workflows for authorised staff of {BRAND.institution} and approved partner facilities. It is not a substitute for clinical judgment, emergency services, or statutory reporting obligations.
        </p>

        <h2>3. Eligible use</h2>
        <p>
          Accounts are issued for professional use only. You must provide accurate registration information. New signups may remain inactive until approved by an administrator. You must not share credentials or attempt to access data outside your assigned role.
        </p>

        <h2>4. Confidentiality &amp; patient information</h2>
        <p>
          You may encounter identifiable patient or service-related information. You agree to handle such information in line with applicable policies, professional duties, and data-protection requirements. Do not export, copy, or disclose information except as required for your authorised duties.
        </p>

        <h2>5. Acceptable use</h2>
        <p>
          You must not misuse the system, attempt to bypass security controls, probe for unauthorised access, upload malicious content, or use the service for unlawful, harassing, or discriminatory purposes.
        </p>

        <h2>6. Availability &amp; changes</h2>
        <p>
          The service may be updated, limited, or interrupted for maintenance or operational reasons. Features and these Terms may change; continued use after notice constitutes acceptance where permitted by law.
        </p>

        <h2>7. Liability</h2>
        <p>
          The platform is provided &quot;as is&quot; to the extent permitted by law. {BRAND.institution} and its operators are not liable for indirect or consequential loss arising from use or inability to use the service, subject to any rights that cannot be excluded by law.
        </p>

        <h2>8. Contact</h2>
        <p>
          For access issues, policy questions, or suspected misuse, contact your {BRAND.institution} system administrator or information governance lead.
        </p>
      </main>

      <footer className="container py-8 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} {BRAND.institution}
      </footer>
    </div>
  );
}
