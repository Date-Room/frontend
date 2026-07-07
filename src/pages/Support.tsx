/*
 * Support page — single source of truth for contact and common questions.
 * Linked from the App Store listing's required Support URL field, and
 * surfaced in-app from Settings → Help (future).
 */

import { ArrowLeft, Mail, MessageCircleQuestion, LifeBuoy, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { BRAND_NAME } from "@/lib/constants";
import { PageShell } from "@/components/PageShell";

const SUPPORT_EMAIL = "support@dateroom.io";
const PRIVACY_EMAIL = "privacy@dateroom.io";

export default function Support() {
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
          Support
        </p>

        <h1 className="font-serif font-semibold text-3xl md:text-4xl text-cream mb-3 tracking-tight">
          How can we help?
        </h1>
        <p className="text-sm text-muted-foreground mb-10 leading-relaxed">
          Get in touch, read common answers, or report something that doesn't feel right.
        </p>

        <div className="relative rounded-[1.75rem] border border-white/[0.08] bg-gradient-to-br from-card/95 via-card/45 to-primary/[0.05] backdrop-blur-xl p-7 md:p-8 space-y-8 text-sm text-cream/90 leading-relaxed shadow-[0_28px_90px_rgba(0,0,0,0.38)] ring-1 ring-white/[0.06]">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-primary/15 blur-3xl opacity-70 hidden md:block"
            aria-hidden
          />

          <Section title="Contact us" icon={<Mail className="w-4 h-4 text-rosegold" aria-hidden />}>
            <p className="text-muted-foreground">
              The fastest way to reach the {BRAND_NAME} team is by email. We aim
              to reply within one business day.
            </p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>
                <span className="text-cream/90">General questions, account help, bug reports:</span>{" "}
                <a className="text-rosegold hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li>
                <span className="text-cream/90">Privacy, data requests, deletion:</span>{" "}
                <a className="text-rosegold hover:underline" href={`mailto:${PRIVACY_EMAIL}`}>
                  {PRIVACY_EMAIL}
                </a>
              </li>
            </ul>
          </Section>

          <Section
            title="Common questions"
            icon={<MessageCircleQuestion className="w-4 h-4 text-rosegold" aria-hidden />}
            divider
          >
            <FaqItem q="How do I invite someone to a room?">
              Tap the share button inside a room to send the invite link by
              text, email, or any app on your device. The link opens directly
              into the room — your guest doesn't need to download anything to
              join on web, but they'll have a smoother experience in the app.
            </FaqItem>
            <FaqItem q="Why did my room disappear?">
              Session rooms live for about 20 minutes from when they're
              created. If you want a room that stays open across nights,
              promote it to a permanent room from the room screen — that
              requires an active subscription.
            </FaqItem>
            <FaqItem q="How do I cancel a subscription?">
              Subscriptions purchased on iOS are managed in your Apple ID
              settings (Settings → your name → Subscriptions). Cancellations
              take effect at the end of the current billing period.
            </FaqItem>
            <FaqItem q="How do I delete my account?">
              You can request account deletion from the in-app Settings screen,
              or by emailing{" "}
              <a className="text-rosegold hover:underline" href={`mailto:${PRIVACY_EMAIL}`}>
                {PRIVACY_EMAIL}
              </a>
              . Deletion removes your profile and the rooms you host; cascading
              deletes wipe associated content.
            </FaqItem>
            <FaqItem q="My camera or microphone isn't working.">
              Confirm {BRAND_NAME} has permission to use the camera and
              microphone (iOS Settings → DateRoom; or your browser's site
              permissions on web). Reconnect to the room if you grant
              permission while inside it.
            </FaqItem>
          </Section>

          <Section
            title="Report a problem"
            icon={<LifeBuoy className="w-4 h-4 text-rosegold" aria-hidden />}
            divider
          >
            <p className="text-muted-foreground">
              If someone is using {BRAND_NAME} to harass, scam, or exploit
              others, please report it immediately. Include the room code (if
              you have it), the display name of the person involved, and a
              short description of what happened. We review every report and
              act on confirmed violations.
            </p>
            <p className="mt-3 text-muted-foreground">
              Email{" "}
              <a className="text-rosegold hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>{" "}
              with the subject line "Trust &amp; Safety".
            </p>
          </Section>

          <Section
            title="Trust &amp; safety"
            icon={<ShieldCheck className="w-4 h-4 text-rosegold" aria-hidden />}
            divider
          >
            <p className="text-muted-foreground">
              You can read how we handle your data in our{" "}
              <Link to="/privacy" className="text-rosegold hover:underline">
                privacy policy
              </Link>
              , and the rules everyone agrees to when they use the service in
              our{" "}
              <Link to="/terms" className="text-rosegold hover:underline">
                terms of service
              </Link>
              .
            </p>
          </Section>
        </div>

        <p className="mt-8 text-center text-[11px] uppercase tracking-[0.28em] text-muted-foreground/70">
          <Link to="/privacy" className="hover:text-cream transition-colors">
            Privacy
          </Link>
          <span className="mx-3 text-muted-foreground/30">·</span>
          <Link to="/terms" className="hover:text-cream transition-colors">
            Terms
          </Link>
        </p>
      </main>
    </PageShell>
  );
}

function Section({
  title,
  icon,
  children,
  divider,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <section className={`relative space-y-2 ${divider ? "pt-6 border-t border-white/[0.07]" : ""}`}>
      <h2 className="font-semibold text-cream text-[15px] tracking-tight flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 pb-3 last:pb-0">
      <h3 className="text-cream/95 text-[14px] font-medium">{q}</h3>
      <p className="text-muted-foreground text-[13.5px] leading-relaxed">{children}</p>
    </div>
  );
}
