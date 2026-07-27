/*
 * Child safety standards — published CSAE (child sexual abuse and
 * exploitation) standards required by Google Play for apps in the
 * Social / Dating categories. Linked from the app (Settings → Report a
 * Safety Concern) and referenced in the Play Console "Child safety
 * standards" declaration, so the /child-safety path must stay stable and
 * the page must remain publicly reachable and non-editable by users.
 *
 * TODO(legal): plain-language drafting intended for review by counsel
 * before launch. The standards described here are commitments we must be
 * operationally ready to honour (report triage, law-enforcement reporting).
 */

import { BRAND_NAME } from "@/lib/constants";
import { LegalShell, type LegalSection } from "@/components/LegalShell";

const LAST_UPDATED = "27 July 2026";
const SAFETY_EMAIL = "support@blacheinc.com";

export default function ChildSafety() {
  const sections: LegalSection[] = [
    {
      id: "commitment",
      title: "Our commitment",
      body: (
        <p>
          {BRAND_NAME} is a private virtual space for couples and is intended
          only for adults aged 18 and over. We have zero tolerance for child
          sexual abuse and exploitation (CSAE), including child sexual abuse
          material (CSAM). These standards describe how we work to prevent,
          detect, and respond to CSAE on {BRAND_NAME}, and how anyone can report
          a concern to us. The service is operated by Wired Intelligence Ltd.
          (trading as Blache).
        </p>
      ),
    },
    {
      id: "adults-only",
      title: "Adults only (18+)",
      body: (
        <p>
          {BRAND_NAME} is restricted to users aged 18 and over. Accounts are
          declared as an adult audience on the app stores, and we ask stores to
          block users who are determined to be minors from downloading the app
          or making purchases. We do not knowingly allow anyone under 18 to
          create an account or use the service. If we learn that a user is a
          minor, we remove their access.
        </p>
      ),
    },
    {
      id: "prohibited",
      title: "What is prohibited",
      body: (
        <>
          <p>
            The following are strictly prohibited on {BRAND_NAME} and will
            result in immediate removal and a permanent ban, in addition to any
            reporting required by law:
          </p>
          <ul className="list-disc pl-5 space-y-2 marker:text-rosegold/60">
            <li>
              Child sexual abuse material (CSAM) — any image, video, or other
              content that sexualises a minor.
            </li>
            <li>
              Grooming, solicitation, or any sexual contact or communication
              directed at a minor.
            </li>
            <li>
              Any attempt to use {BRAND_NAME} to produce, store, share, or
              access CSAE material, or to involve a minor in adult sexual
              activity.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "report",
      title: "How to report a child safety concern",
      body: (
        <>
          <p>
            If you encounter content or behaviour that puts a child at risk, or
            any suspected CSAE, report it to us immediately. You can report from
            inside the app (Settings → Report a Safety Concern) or by emailing
            our safety team at{" "}
            <a
              className="text-rosegold hover:underline"
              href={`mailto:${SAFETY_EMAIL}?subject=Child%20safety%20report`}
            >
              {SAFETY_EMAIL}
            </a>
            . Please include as much detail as you safely can — what you saw,
            where, and when.
          </p>
          <p className="text-muted-foreground/80 text-[13px]">
            If a child is in immediate danger, contact your local emergency
            services first.
          </p>
        </>
      ),
    },
    {
      id: "response",
      title: "How we respond",
      body: (
        <ul className="list-disc pl-5 space-y-2 marker:text-rosegold/60">
          <li>
            We review reports of CSAE as a priority and act to remove offending
            content and accounts.
          </li>
          <li>
            We permanently ban users responsible for CSAE and preserve relevant
            information as required to support investigations.
          </li>
          <li>
            We report apparent CSAM to the National Center for Missing &amp;
            Exploited Children (NCMEC) and/or the appropriate authorities in the
            relevant jurisdiction, as required by law.
          </li>
        </ul>
      ),
    },
    {
      id: "compliance",
      title: "Legal compliance",
      body: (
        <p>
          {BRAND_NAME} complies with applicable child safety laws in the
          jurisdictions where it operates, and reports CSAE to regional and
          national authorities where required. We keep these standards under
          review and update our practices as our obligations evolve.
        </p>
      ),
    },
    {
      id: "contact",
      title: "Point of contact",
      body: (
        <p>
          Our designated point of contact for child safety matters is{" "}
          <a
            className="text-rosegold hover:underline"
            href={`mailto:${SAFETY_EMAIL}?subject=Child%20safety%20standards`}
          >
            {SAFETY_EMAIL}
          </a>
          . This contact is able to speak to our CSAE prevention and response
          practices.
        </p>
      ),
    },
  ];

  return (
    <LegalShell
      eyebrow="Child safety"
      title="Child safety standards"
      intro={`How ${BRAND_NAME} prevents, detects, and responds to child sexual abuse and exploitation.`}
      lastUpdated={LAST_UPDATED}
      sections={sections}
      crossLink={{ to: "/privacy", label: "Privacy & safety" }}
    />
  );
}
