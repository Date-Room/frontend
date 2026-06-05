/*
 * Privacy policy — production copy describing the deployed DateRoom stack
 * (Supabase Auth + Postgres, FastAPI on Railway, LiveKit, Stripe, optional
 * Google / Apple OAuth, YouTube embeds for Watch + DJ).
 *
 * TODO(legal): this page is plain-language drafting intended for review by
 * counsel before any production launch. Do not treat as legally binding
 * as-is.
 */

import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { BRAND_NAME } from "@/lib/constants";
import { PageShell } from "@/components/PageShell";

const LAST_UPDATED = "5 June 2026";
const PRIVACY_EMAIL = "privacy@dateroom.io";

export default function Privacy() {
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
          Privacy policy
        </p>

        <h1 className="font-serif italic text-3xl md:text-4xl text-cream mb-3 tracking-tight">
          Privacy &amp; safety
        </h1>
        <p className="text-sm text-muted-foreground mb-10 leading-relaxed">
          How {BRAND_NAME} handles your data across the app, web client, and our backend.
        </p>

        <div className="relative rounded-[1.75rem] border border-white/[0.08] bg-gradient-to-br from-card/95 via-card/45 to-primary/[0.05] backdrop-blur-xl p-7 md:p-8 space-y-8 text-sm text-cream/90 leading-relaxed shadow-[0_28px_90px_rgba(0,0,0,0.38)] ring-1 ring-white/[0.06]">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-primary/15 blur-3xl opacity-70 hidden md:block"
            aria-hidden
          />

          <Section title="Who we are">
            <p className="text-muted-foreground">
              {BRAND_NAME} is a virtual date room for two. The service is operated by
              the DateRoom team. For privacy questions or requests, write to{" "}
              <a className="text-rosegold hover:underline" href={`mailto:${PRIVACY_EMAIL}`}>
                {PRIVACY_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section title="What we collect" divider>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground marker:text-rosegold/60">
              <li>
                <span className="text-cream/90">Account.</span> Your email and the
                Supabase auth identifier we receive when you sign in. Optional:
                display name, profile photo (stored as a data URI or as an external
                URL such as a Google avatar), country (ISO alpha-2 code), and your
                notification preference.
              </li>
              <li>
                <span className="text-cream/90">Rooms.</span> Room code, optional
                PIN, persistence (session or persistent), customised theme and
                background, and recap content captured during a session (within
                the retention window described below).
              </li>
              <li>
                <span className="text-cream/90">Activity content.</span> Chat
                messages, DJ track queue and playback history, Watch video state,
                camera-shutter captures (saved to your device's photo library),
                reactions, and — in persistent rooms — journal entries.
              </li>
              <li>
                <span className="text-cream/90">Real-time presence.</span> Who is
                in a room, microphone and camera state, and in-call status while
                you are connected.
              </li>
              <li>
                <span className="text-cream/90">Payments.</span> Your Stripe
                customer identifier and subscription state. Card numbers are
                handled by Stripe directly; we never see or store them.
              </li>
              <li>
                <span className="text-cream/90">Device and technical data.</span>{" "}
                IP address, user agent, and basic request logs that help us keep
                the service running and prevent abuse.
              </li>
            </ul>
          </Section>

          <Section title="How we use it" divider>
            <p className="text-muted-foreground">
              We use this data to run the service: authenticate you, synchronise
              what each person in a room sees, deliver real-time audio and video,
              process subscriptions, and prevent abuse. We do not sell your
              personal data and we do not use the content of your rooms to train
              advertising profiles.
            </p>
          </Section>

          <Section title="Third parties we share data with" divider>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground marker:text-rosegold/60">
              <li>
                <span className="text-cream/90">Supabase</span> — authentication
                and our Postgres database.
              </li>
              <li>
                <span className="text-cream/90">LiveKit</span> — real-time audio
                and video streams. Tokens are minted by our backend.
              </li>
              <li>
                <span className="text-cream/90">Stripe</span> — subscription
                billing and payment processing.
              </li>
              <li>
                <span className="text-cream/90">Google and Apple</span> — only
                when you choose to sign in with one of those providers.
              </li>
              <li>
                <span className="text-cream/90">YouTube</span> — embedded video
                playback inside the Watch and DJ activities.
              </li>
              <li>
                <span className="text-cream/90">Railway and Vercel</span> — our
                backend and frontend hosting providers.
              </li>
            </ul>
            <p className="text-muted-foreground/80 text-[13px] mt-3">
              Each provider has its own privacy practices. Where appropriate, we
              put data-processing agreements and standard contractual clauses in
              place with these sub-processors.
            </p>
          </Section>

          <Section title="Audio and video" divider>
            <p className="text-muted-foreground">
              Calls are delivered through LiveKit — peer-to-peer where the
              network allows, relayed through LiveKit's servers when it doesn't.
              {" "}
              <span className="text-cream/90">We do not record calls.</span> If
              either participant uses OS-level screen recording, screenshots, or
              third-party capture, that is outside our control and is their
              responsibility.
            </p>
          </Section>

          <Section title="Retention" divider>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground marker:text-rosegold/60">
              <li>
                Recap of a session room is viewable for 24 hours after the room
                ends, and then deleted.
              </li>
              <li>
                Persistent room content — chat, journal entries, library — lives
                as long as the room itself.
              </li>
              <li>
                When a participant is kicked from a room, their activity state
                and captures associated with that room are wiped.
              </li>
              <li>
                Account deletion removes your user row and cascades to the
                participant rows and invites under your account. We may retain a
                hashed reference in our audit logs to help prevent fraud and
                abuse re-registrations.
              </li>
            </ul>
          </Section>

          <Section title="Cookies and local storage" divider>
            <p className="text-muted-foreground">
              The web client stores a small amount of data on your device so the
              app works between sessions: your sign-in token, a cache of rooms
              you've been in, theme and background preferences, the last
              display name you used to join as a guest, and the position of the
              mini-player. We don't use third-party advertising cookies.
            </p>
          </Section>

          <Section title="Children" divider>
            <p className="text-muted-foreground">
              {BRAND_NAME} is for adults. You must be 18 or older to use the
              service. We don't knowingly collect data from anyone under 18 — if
              you believe we have, please contact us and we'll remove it.
            </p>
          </Section>

          <Section title="Your rights" divider>
            <p className="text-muted-foreground">
              You can request a copy of your data, ask us to correct
              inaccuracies, or delete your account at any time. The fastest path
              for deletion is the Settings screen. For everything else, email{" "}
              <a className="text-rosegold hover:underline" href={`mailto:${PRIVACY_EMAIL}`}>
                {PRIVACY_EMAIL}
              </a>
              .
            </p>
          </Section>

          {/* TODO(legal): confirm whether SCCs / DPAs are in place with each
              sub-processor before launch. */}
          <Section title="International transfers" divider>
            <p className="text-muted-foreground">
              Our hosting providers operate in the United States and the
              European Union, so your data may be processed in either region
              depending on where the underlying services route traffic. Where
              required, we rely on standard contractual clauses with our
              sub-processors.
            </p>
          </Section>

          <Section title="Changes to this policy" divider>
            <p className="text-muted-foreground">
              If we change how we handle your data, we'll update this page and
              move the date below. Check back here, or watch for in-app notice
              for material changes.
            </p>
          </Section>

          <Section title="Last updated" divider>
            <p className="text-muted-foreground">{LAST_UPDATED}</p>
          </Section>
        </div>

        <p className="mt-8 text-center text-[11px] uppercase tracking-[0.28em] text-muted-foreground/70">
          <Link to="/terms" className="hover:text-cream transition-colors">
            Terms of service
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
