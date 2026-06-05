/*
 * Terms of service — production draft.
 *
 * TODO(legal): this page is a plain-language draft for review by counsel
 * before any production launch. Several clauses (governing law,
 * arbitration, liability cap) are placeholders and must be confirmed by
 * a qualified lawyer in the relevant jurisdiction.
 */

import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { BRAND_NAME } from "@/lib/constants";
import { PageShell } from "@/components/PageShell";

const LAST_UPDATED = "5 June 2026";
const LEGAL_EMAIL = "legal@dateroom.io";

export default function Terms() {
  return (
    <PageShell>
      <main className="max-w-xl mx-auto px-6 pt-12 pb-28 relative z-10 animate-fade-in">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-muted-foreground hover:text-cream hover:bg-white/[0.06] transition-colors mb-10 text-sm border border-transparent hover:border-white/[0.08]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />
          Back
        </Link>

        <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground mb-4 flex items-center gap-3">
          <span className="h-px w-8 bg-gradient-to-r from-transparent via-primary/55 to-primary rounded-full shrink-0" aria-hidden />
          Terms of service
        </p>

        <h1 className="font-serif italic text-3xl md:text-4xl text-cream mb-3 tracking-tight">
          Terms of service
        </h1>
        <p className="text-sm text-muted-foreground mb-10 leading-relaxed">
          The agreement between you and {BRAND_NAME} when you use the service.
        </p>

        <div className="relative rounded-[1.75rem] border border-white/[0.08] bg-gradient-to-br from-card/95 via-card/45 to-primary/[0.05] backdrop-blur-xl p-7 md:p-8 space-y-8 text-sm text-cream/90 leading-relaxed shadow-[0_28px_90px_rgba(0,0,0,0.38)] ring-1 ring-white/[0.06]">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-primary/15 blur-3xl opacity-70 hidden md:block"
            aria-hidden
          />

          <Section title="Acceptance">
            <p className="text-muted-foreground">
              By creating an account, signing in, or otherwise using
              {" "}
              {BRAND_NAME}, you agree to these terms. If you don't agree,
              please don't use the service.
            </p>
          </Section>

          <Section title="Eligibility" divider>
            <p className="text-muted-foreground">
              You must be at least 18 years old and legally able to enter into
              a contract in your jurisdiction. {BRAND_NAME} is designed for
              adult, consensual one-to-one connection.
            </p>
          </Section>

          <Section title="Your account" divider>
            <p className="text-muted-foreground">
              You agree to provide accurate information when you sign up and
              keep your sign-in details safe. You are responsible for the
              activity that happens under your account. One person, one
              account. Don't share credentials.
            </p>
          </Section>

          <Section title="Acceptable use" divider>
            <p className="text-muted-foreground">Don't use {BRAND_NAME} to:</p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground marker:text-rosegold/60 mt-2">
              <li>harass, threaten, or stalk anyone;</li>
              <li>contact, expose, or attempt to involve a minor;</li>
              <li>
                record, screenshot, or capture another participant without their
                explicit consent;
              </li>
              <li>
                impersonate another person or misrepresent who you are;
              </li>
              <li>
                share content that is illegal where you are or where the other
                participant is (including but not limited to non-consensual
                imagery and content depicting minors);
              </li>
              <li>scrape, reverse engineer, or automate the service; or</li>
              <li>
                attempt to disrupt the service or circumvent its security or
                rate limits.
              </li>
            </ul>
            <p className="text-muted-foreground mt-3">
              We may suspend or terminate accounts that violate these rules,
              with or without notice depending on severity.
            </p>
          </Section>

          <Section title="Subscriptions and billing" divider>
            <p className="text-muted-foreground">
              Paid features are billed through Stripe on a monthly auto-renewing
              subscription. You can cancel at any time; cancellation takes
              effect at the end of your current billing period and you keep
              access until then. Refunds are issued at our discretion.
            </p>
            <p className="text-muted-foreground mt-2">
              Persistent rooms require an active subscription on the host's
              account. If the host's subscription lapses, the room enters a
              {" "}
              <span className="text-cream/90">sub_lapsed</span> state and is
              read-only until the subscription is renewed. Content is not
              deleted during that window — see the Privacy policy for retention
              details.
            </p>
          </Section>

          <Section title="Your content" divider>
            <p className="text-muted-foreground">
              You own the messages, photos, journal entries, and other content
              you create on {BRAND_NAME}. By posting content into a room, you
              grant us a limited, non-exclusive licence to host, transmit, and
              display that content to the other participants in that room and
              to operate the service. We don't use your content for advertising
              and we don't sell it.
            </p>
          </Section>

          <Section title="Reporting and moderation" divider>
            <p className="text-muted-foreground">
              You can report behaviour or content from within the app. We may
              review reported messages, captures, or media to keep the service
              safe. We may remove content or restrict accounts at our reasonable
              discretion when there is a credible safety, legal, or
              terms-of-service concern.
            </p>
          </Section>

          <Section title="Termination" divider>
            <p className="text-muted-foreground">
              You can close your account at any time from Settings. We can
              suspend or terminate your account immediately if you breach these
              terms or if continued access would put other users or the service
              at risk. When your account is closed, your data is handled
              according to the Privacy policy.
            </p>
          </Section>

          {/* TODO(legal): jurisdiction-specific consumer-rights language may
              be required; have counsel confirm before launch. */}
          <Section title="Disclaimers" divider>
            <p className="text-muted-foreground">
              {BRAND_NAME} is provided on an "as is" and "as available" basis.
              We do our best to keep the service running and to deliver
              real-time audio and video at good quality, but we do not warrant
              that it will be uninterrupted, error-free, or that it will meet
              every expectation. {BRAND_NAME} is not a substitute for emergency
              services.
            </p>
          </Section>

          {/* TODO(legal): confirm enforceability of liability cap in target
              jurisdictions; some consumer-protection regimes carve out
              non-waivable damages. */}
          <Section title="Limitation of liability" divider>
            <p className="text-muted-foreground">
              To the maximum extent permitted by law, {BRAND_NAME} and the team
              behind it are not liable for indirect, incidental, or
              consequential damages arising from your use of the service. Our
              total liability for any claim relating to the service is capped
              at the amount you paid us in the twelve months before the claim.
            </p>
          </Section>

          {/* TODO(legal): confirm jurisdiction. Default below is England and
              Wales (typical default for UK-registered indie SaaS); confirm
              this matches the operating entity. */}
          <Section title="Governing law and disputes" divider>
            <p className="text-muted-foreground">
              These terms are governed by the laws of England and Wales, and
              the courts of England and Wales have non-exclusive jurisdiction
              over any dispute, unless a mandatory consumer-protection law in
              your place of residence says otherwise. We'd prefer to resolve
              issues by email first — write to{" "}
              <a className="text-rosegold hover:underline" href={`mailto:${LEGAL_EMAIL}`}>
                {LEGAL_EMAIL}
              </a>{" "}
              and we'll do our best to make it right.
            </p>
          </Section>

          <Section title="Changes to these terms" divider>
            <p className="text-muted-foreground">
              We may update these terms over time. We'll post the new version
              here and move the date below. If a change is material, we'll
              also flag it in the app. Continuing to use {BRAND_NAME} after a
              change means you accept the new terms.
            </p>
          </Section>

          <Section title="Contact" divider>
            <p className="text-muted-foreground">
              Questions, concerns, or feedback?{" "}
              <a className="text-rosegold hover:underline" href={`mailto:${LEGAL_EMAIL}`}>
                {LEGAL_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section title="Last updated" divider>
            <p className="text-muted-foreground">{LAST_UPDATED}</p>
          </Section>
        </div>

        <p className="mt-8 text-center text-[11px] uppercase tracking-[0.28em] text-muted-foreground/70">
          <Link to="/privacy" className="hover:text-cream transition-colors">
            Privacy policy
          </Link>
        </p>
      </main>
    </PageShell>
  );
}

function Section({
  title,
  children,
  divider,
}: {
  title: string;
  children: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <section className={`relative space-y-2 ${divider ? "pt-6 border-t border-white/[0.07]" : ""}`}>
      <h2 className="font-semibold text-cream text-[15px] tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
