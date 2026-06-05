/*
 * Terms of service — production draft.
 *
 * TODO(legal): this page is a plain-language draft for review by counsel
 * before any production launch. Several clauses (governing law,
 * arbitration, liability cap) are placeholders and must be confirmed by
 * a qualified lawyer in the relevant jurisdiction.
 */

import { BRAND_NAME } from "@/lib/constants";
import { LegalShell, type LegalSection } from "@/components/LegalShell";

const LAST_UPDATED = "5 June 2026";
const LEGAL_EMAIL = "legal@dateroom.io";

export default function Terms() {
  const sections: LegalSection[] = [
    {
      id: "acceptance",
      title: "Acceptance",
      body: (
        <p>
          By creating an account, signing in, or otherwise using {BRAND_NAME},
          you agree to these terms. If you don't agree, please don't use the
          service.
        </p>
      ),
    },
    {
      id: "eligibility",
      title: "Eligibility",
      body: (
        <p>
          You must be at least 18 years old and legally able to enter into a
          contract in your jurisdiction. {BRAND_NAME} is designed for adult,
          consensual one-to-one connection.
        </p>
      ),
    },
    {
      id: "your-account",
      title: "Your account",
      body: (
        <p>
          You agree to provide accurate information when you sign up and keep
          your sign-in details safe. You are responsible for the activity that
          happens under your account. One person, one account. Don't share
          credentials.
        </p>
      ),
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      body: (
        <>
          <p>Don't use {BRAND_NAME} to:</p>
          <ul className="list-disc pl-5 space-y-2 marker:text-rosegold/60">
            <li>harass, threaten, or stalk anyone;</li>
            <li>contact, expose, or attempt to involve a minor;</li>
            <li>
              record, screenshot, or capture another participant without their
              explicit consent;
            </li>
            <li>impersonate another person or misrepresent who you are;</li>
            <li>
              share content that is illegal where you are or where the other
              participant is (including but not limited to non-consensual
              imagery and content depicting minors);
            </li>
            <li>scrape, reverse engineer, or automate the service; or</li>
            <li>
              attempt to disrupt the service or circumvent its security or rate
              limits.
            </li>
          </ul>
          <p>
            We may suspend or terminate accounts that violate these rules, with
            or without notice depending on severity.
          </p>
        </>
      ),
    },
    {
      id: "subscriptions",
      title: "Subscriptions and billing",
      body: (
        <>
          <p>
            Paid features are billed through Stripe on a monthly auto-renewing
            subscription. You can cancel at any time; cancellation takes effect
            at the end of your current billing period and you keep access until
            then. Refunds are issued at our discretion.
          </p>
          <p>
            Persistent rooms require an active subscription on the host's
            account. If the host's subscription lapses, the room enters a{" "}
            <span className="text-cream/90">sub_lapsed</span> state and is
            read-only until the subscription is renewed. Content is not deleted
            during that window — see the Privacy policy for retention details.
          </p>
        </>
      ),
    },
    {
      id: "your-content",
      title: "Your content",
      body: (
        <p>
          You own the messages, photos, journal entries, and other content you
          create on {BRAND_NAME}. By posting content into a room, you grant us a
          limited, non-exclusive licence to host, transmit, and display that
          content to the other participants in that room and to operate the
          service. We don't use your content for advertising and we don't sell
          it.
        </p>
      ),
    },
    {
      id: "reporting",
      title: "Reporting and moderation",
      body: (
        <p>
          You can report behaviour or content from within the app. We may
          review reported messages, captures, or media to keep the service
          safe. We may remove content or restrict accounts at our reasonable
          discretion when there is a credible safety, legal, or
          terms-of-service concern.
        </p>
      ),
    },
    {
      id: "termination",
      title: "Termination",
      body: (
        <p>
          You can close your account at any time from Settings. We can suspend
          or terminate your account immediately if you breach these terms or if
          continued access would put other users or the service at risk. When
          your account is closed, your data is handled according to the Privacy
          policy.
        </p>
      ),
    },
    /* TODO(legal): jurisdiction-specific consumer-rights language may
        be required; have counsel confirm before launch. */
    {
      id: "disclaimers",
      title: "Disclaimers",
      body: (
        <p>
          {BRAND_NAME} is provided on an "as is" and "as available" basis. We do
          our best to keep the service running and to deliver real-time audio
          and video at good quality, but we do not warrant that it will be
          uninterrupted, error-free, or that it will meet every expectation.
          {" "}
          {BRAND_NAME} is not a substitute for emergency services.
        </p>
      ),
    },
    /* TODO(legal): confirm enforceability of liability cap in target
        jurisdictions; some consumer-protection regimes carve out
        non-waivable damages. */
    {
      id: "liability",
      title: "Limitation of liability",
      body: (
        <p>
          To the maximum extent permitted by law, {BRAND_NAME} and the team
          behind it are not liable for indirect, incidental, or consequential
          damages arising from your use of the service. Our total liability for
          any claim relating to the service is capped at the amount you paid us
          in the twelve months before the claim.
        </p>
      ),
    },
    /* TODO(legal): confirm jurisdiction. Default below is England and
        Wales (typical default for UK-registered indie SaaS); confirm
        this matches the operating entity. */
    {
      id: "governing-law",
      title: "Governing law and disputes",
      body: (
        <p>
          These terms are governed by the laws of England and Wales, and the
          courts of England and Wales have non-exclusive jurisdiction over any
          dispute, unless a mandatory consumer-protection law in your place of
          residence says otherwise. We'd prefer to resolve issues by email
          first — write to{" "}
          <a className="text-rosegold hover:underline" href={`mailto:${LEGAL_EMAIL}`}>
            {LEGAL_EMAIL}
          </a>{" "}
          and we'll do our best to make it right.
        </p>
      ),
    },
    {
      id: "changes",
      title: "Changes to these terms",
      body: (
        <p>
          We may update these terms over time. We'll post the new version here
          and move the date below. If a change is material, we'll also flag it
          in the app. Continuing to use {BRAND_NAME} after a change means you
          accept the new terms.
        </p>
      ),
    },
    {
      id: "contact",
      title: "Contact",
      body: (
        <p>
          Questions, concerns, or feedback?{" "}
          <a className="text-rosegold hover:underline" href={`mailto:${LEGAL_EMAIL}`}>
            {LEGAL_EMAIL}
          </a>
          .
        </p>
      ),
    },
  ];

  return (
    <LegalShell
      eyebrow="Terms of service"
      title="Terms of service"
      intro={`The agreement between you and ${BRAND_NAME} when you use the service.`}
      lastUpdated={LAST_UPDATED}
      sections={sections}
      crossLink={{ to: "/privacy", label: "Privacy policy" }}
    />
  );
}
