/*
 * Privacy policy — production copy describing the deployed DateRoom stack
 * (Supabase Auth + Postgres, FastAPI on Railway, LiveKit, Stripe on web,
 * Apple in-app purchase on iOS, optional Google / Apple OAuth, YouTube
 * embeds for Watch + DJ).
 *
 * TODO(legal): this page is plain-language drafting intended for review by
 * counsel before any production launch. Do not treat as legally binding
 * as-is. In particular, the "AI safety layer (Chaperon)" section processes
 * BOTH participants' voices while only the initiator opts in — counsel should
 * confirm the consent model (two-party-consent states, GDPR/UK special-category
 * data, and whether the "announce presence" disclosure must default on).
 */

import { BRAND_NAME } from "@/lib/constants";
import { LegalShell, type LegalSection } from "@/components/LegalShell";

const LAST_UPDATED = "17 August 2026";
const PRIVACY_EMAIL = "privacy@dateroom.io";

export default function Privacy() {
  const sections: LegalSection[] = [
    {
      id: "who-we-are",
      title: "Who we are",
      body: (
        <p>
          {BRAND_NAME} is a virtual date room for two. This policy covers the
          iOS app, the web client, and our backend. The service is operated by{" "}
          Wired Intelligence Ltd. (trading as Blache) (&ldquo;we&rdquo;,
          &ldquo;us&rdquo;). For privacy
          questions or requests, write to{" "}
          <a className="text-rosegold hover:underline" href={`mailto:${PRIVACY_EMAIL}`}>
            {PRIVACY_EMAIL}
          </a>
          .
        </p>
      ),
    },
    {
      id: "what-we-collect",
      title: "What we collect",
      body: (
        <ul className="list-disc pl-5 space-y-2 marker:text-rosegold/60">
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
            background, and recap content captured during a session (within the
            retention window described below).
          </li>
          <li>
            <span className="text-cream/90">Activity content.</span> Chat
            messages, DJ track queue and playback history, Watch video state,
            camera-shutter captures (saved to your device's photo library),
            reactions, and — in persistent rooms — journal entries.
          </li>
          <li>
            <span className="text-cream/90">Real-time presence.</span> Who is in
            a room, microphone and camera state, and in-call status while you
            are connected.
          </li>
          <li>
            <span className="text-cream/90">Payments.</span> When you buy on the
            web, your Stripe customer identifier and subscription state; card
            numbers are handled by Stripe directly and we never see or store
            them. When you buy inside the iOS app, purchases are processed by
            Apple through in-app purchase — Apple handles your payment details,
            and we receive only the resulting purchase receipt and entitlement
            state (which products and passes you own), never your card number or
            Apple ID credentials.
          </li>
          <li>
            <span className="text-cream/90">Device and technical data.</span> IP
            address, user agent, and basic request logs that help us keep the
            service running and prevent abuse.
          </li>
        </ul>
      ),
    },
    {
      id: "how-we-use-it",
      title: "How we use it",
      body: (
        <p>
          We use this data to run the service: authenticate you, synchronise
          what each person in a room sees, deliver real-time audio and video,
          process subscriptions, and prevent abuse. We do not sell your personal
          data, and we do not use the content of your rooms to build advertising
          profiles or to train general-purpose AI models. The optional Chaperon
          safety layer is the one exception, described in{" "}
          <span className="text-cream/90">&ldquo;AI safety layer (Chaperon)&rdquo;</span>{" "}
          below: when you switch it on, room audio is processed to generate
          private safety and coaching cues, and your ratings of those cues may
          be used to improve that feature.
        </p>
      ),
    },
    {
      id: "third-parties",
      title: "Third parties we share data with",
      body: (
        <>
          <ul className="list-disc pl-5 space-y-2 marker:text-rosegold/60">
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
              billing and payment processing on the web.
            </li>
            <li>
              <span className="text-cream/90">Apple</span> — on iOS, in-app
              purchases (the Together subscription, Date Pack, Long Pack, and
              time extensions) are processed by Apple through the App Store.
              Apple handles your payment and reports purchase and entitlement
              data back to us.
            </li>
            <li>
              <span className="text-cream/90">Google and Apple sign-in</span> —
              only when you choose to sign in with one of those providers.
            </li>
            <li>
              <span className="text-cream/90">YouTube</span> — embedded video
              playback inside the Watch and DJ activities.
            </li>
            <li>
              <span className="text-cream/90">Railway and Vercel</span> — our
              backend and frontend hosting providers.
            </li>
            <li>
              <span className="text-cream/90">AI processing providers</span> —
              only when the Chaperon safety layer is switched on for a call, a
              speech-to-text provider and a large-language-model provider (such
              as Anthropic, Google, or OpenAI) process the call audio on our
              behalf to generate safety and coaching cues. They act as our
              sub-processors under a data-processing agreement and are instructed
              not to use your data to train their own models. When Chaperon is
              off, no call content is sent to them.
            </li>
          </ul>
          <p className="text-muted-foreground/80 text-[13px]">
            Each provider has its own privacy practices. Where appropriate, we
            put data-processing agreements and standard contractual clauses in
            place with these sub-processors.
          </p>
        </>
      ),
    },
    {
      id: "audio-video",
      title: "Audio and video",
      body: (
        <p>
          Calls are delivered through LiveKit — peer-to-peer where the network
          allows, relayed through LiveKit's servers when it doesn't.{" "}
          <span className="text-cream/90">We do not save audio or video
          recordings of your calls.</span> The one thing that processes your
          call audio is the optional Chaperon safety layer, and only when
          someone in the room turns it on — it transcribes and analyses speech
          in real time to produce private safety cues, but does not keep the
          recording. See{" "}
          <span className="text-cream/90">&ldquo;AI safety layer (Chaperon)&rdquo;</span>{" "}
          below. If either participant uses OS-level screen recording,
          screenshots, or third-party capture, that is outside our control and
          is their responsibility.
        </p>
      ),
    },
    {
      id: "chaperon",
      title: "AI safety layer (Chaperon)",
      body: (
        <>
          <p>
            Chaperon is an optional feature on one-off date rooms. When someone
            in the room turns it on, an automated system joins the call on our
            server and listens to the audio to watch for signs of scams,
            pressure, or unsafe situations, and — if the paid Coach option is
            enabled — to offer gentle conversational cues. It works like this:
          </p>
          <ul className="mt-3 list-disc pl-5 space-y-2 marker:text-rosegold/60">
            <li>
              <span className="text-cream/90">Both sides' speech is
              processed.</span> To do its job the system transcribes and
              analyses what both participants say during the call, even though
              the resulting cues are shown only to the person who turned it on.
              Those cues (&ldquo;whispers&rdquo;) are private to that person and
              are never shown to the other participant.
            </li>
            <li>
              <span className="text-cream/90">You control whether the other
              person is told.</span> There is a &ldquo;Tell them a chaperon is
              on&rdquo; option. Because Chaperon processes the other person's
              voice, we recommend that you only use it with their knowledge, and
              your local laws may require their consent. Turning it on means you
              confirm you may lawfully do so.
            </li>
            <li>
              <span className="text-cream/90">You choose what is kept.</span>{" "}
              Chaperon offers a no-retention setting, where nothing about the
              call is stored after it ends. On the default setting we keep a
              short after-date &ldquo;debrief&rdquo; summary and a log of the
              cues it raised, visible only to you, so you can review the date
              (see Retention). We do not keep the raw audio in either case.
            </li>
            <li>
              <span className="text-cream/90">Feedback helps improve it.</span>{" "}
              When you rate a cue with 👍 or 👎, we may use that rating and the
              associated cue to improve the safety and coaching feature. You can
              avoid this by not rating cues, and the no-retention setting keeps
              nothing to learn from.
            </li>
            <li>
              <span className="text-cream/90">It is not a guarantee.</span>{" "}
              Chaperon is an automated aid that can miss things or be wrong. It
              is not a substitute for your own judgment, and it is not a
              monitoring or emergency service. See our Terms for more.
            </li>
          </ul>
          <p className="mt-3 text-muted-foreground/80 text-[13px]">
            Chaperon is off unless you switch it on, and you can turn it off at
            any time during a call.
          </p>
        </>
      ),
    },
    {
      id: "retention",
      title: "Retention",
      body: (
        <ul className="list-disc pl-5 space-y-2 marker:text-rosegold/60">
          <li>
            Recap of a session room is viewable for 24 hours after the room
            ends, and then deleted.
          </li>
          <li>
            Chaperon's after-date debrief and the log of cues it raised are kept
            only for the person who turned it on, so they can review the date,
            and are removed when the room and its recap are deleted. If you chose
            the no-retention setting, none of this is stored. We never keep the
            call's raw audio.
          </li>
          <li>
            Persistent room content — chat, journal entries, library — lives as
            long as the room itself.
          </li>
          <li>
            When a participant is kicked from a room, their activity state and
            captures associated with that room are wiped.
          </li>
          <li>
            Account deletion removes your user row and cascades to the
            participant rows and invites under your account. We may retain a
            hashed reference in our audit logs to help prevent fraud and abuse
            re-registrations.
          </li>
        </ul>
      ),
    },
    {
      id: "cookies",
      title: "Cookies and local storage",
      body: (
        <p>
          The web client stores a small amount of data on your device so the
          app works between sessions: your sign-in token, a cache of rooms
          you've been in, theme and background preferences, the last display
          name you used to join as a guest, and the position of the mini-player.
          We don't use third-party advertising cookies.
        </p>
      ),
    },
    {
      id: "children",
      title: "Children",
      body: (
        <p>
          {BRAND_NAME} is for adults. You must be 18 or older to use the
          service. We don't knowingly collect data from anyone under 18 — if you
          believe we have, please contact us and we'll remove it.
        </p>
      ),
    },
    {
      id: "your-rights",
      title: "Your rights",
      body: (
        <p>
          You can request a copy of your data, ask us to correct inaccuracies,
          or delete your account at any time. The fastest path for deletion is
          the Settings screen. For everything else, email{" "}
          <a className="text-rosegold hover:underline" href={`mailto:${PRIVACY_EMAIL}`}>
            {PRIVACY_EMAIL}
          </a>
          .
        </p>
      ),
    },
    /* TODO(legal): confirm whether SCCs / DPAs are in place with each
        sub-processor before launch. */
    {
      id: "international",
      title: "International transfers",
      body: (
        <p>
          Our hosting providers operate in the United States and the European
          Union, so your data may be processed in either region depending on
          where the underlying services route traffic. Where required, we rely
          on standard contractual clauses with our sub-processors.
        </p>
      ),
    },
    {
      id: "changes",
      title: "Changes to this policy",
      body: (
        <p>
          If we change how we handle your data, we'll update this page and move
          the date below. Check back here, or watch for in-app notice for
          material changes.
        </p>
      ),
    },
  ];

  return (
    <LegalShell
      eyebrow="Privacy policy"
      title="Privacy & safety"
      intro={`How ${BRAND_NAME} handles your data across the app, web client, and our backend.`}
      lastUpdated={LAST_UPDATED}
      sections={sections}
      crossLink={{ to: "/terms", label: "Terms of service" }}
    />
  );
}
