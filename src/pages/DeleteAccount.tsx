/*
 * Account deletion instructions.
 *
 * Required as a public URL by Google Play (Data safety → "Delete account
 * URL") and useful for Apple's Guideline 5.1.1(v). The link is shown on the
 * store listing, so this page has to spell out the in-app steps, what is
 * erased, and what is kept — a generic privacy link is not sufficient.
 *
 * Keep in sync with the backend behaviour in `DELETE /v1/users/me`
 * (app/api/v1/users.py): it scrubs PII on the user row, revokes every
 * refresh token, and sets `deleted_at`, after which the account can never
 * be signed into again.
 */

import { BRAND_NAME } from "@/lib/constants";
import { LegalShell, type LegalSection } from "@/components/LegalShell";

const LAST_UPDATED = "21 July 2026";
const PRIVACY_EMAIL = "privacy@dateroom.io";

export default function DeleteAccount() {
  const sections: LegalSection[] = [
    {
      id: "delete-in-app",
      title: "Delete your account in the app",
      body: (
        <>
          <p>
            You can delete your {BRAND_NAME} account yourself, at any time, from
            inside the app. You do not need to contact us, and there is no
            waiting period.
          </p>
          <ol className="list-decimal pl-5 space-y-2 mt-3">
            <li>Open {BRAND_NAME} and sign in.</li>
            <li>
              Tap the <span className="text-cream/90">Profile</span> tab in the
              bottom navigation.
            </li>
            <li>
              Scroll to the bottom and tap{" "}
              <span className="text-cream/90">Delete account</span>.
            </li>
            <li>
              Confirm in the dialog. Your account is deleted immediately and you
              are returned to the sign-in screen.
            </li>
          </ol>
        </>
      ),
    },
    {
      id: "what-is-deleted",
      title: "What is deleted",
      body: (
        <>
          <p>
            Deleting your account permanently erases the personal information
            held on your account record:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 mt-3">
            <li>Your email address</li>
            <li>Your display name</li>
            <li>Your profile photo</li>
            <li>Your date of birth and age confirmation</li>
            <li>Your country and billing region</li>
            <li>
              Your Google or Apple sign-in link, so that identity is no longer
              connected to the account
            </li>
            <li>
              Every active session, so the account is signed out on all devices
            </li>
          </ul>
          <p className="mt-3">
            The account is then permanently closed. It cannot be signed into or
            restored, and signing in again with the same Google or Apple
            identity creates a brand-new account rather than recovering this
            one.
          </p>
        </>
      ),
    },
    {
      id: "what-is-kept",
      title: "What is kept, and why",
      body: (
        <>
          <p>
            {BRAND_NAME} rooms are shared between two people. Content created
            together in a room — journal entries and room memories — is not
            erased when one person deletes their account, because doing so would
            also destroy the other person&rsquo;s copy of a shared memory. That
            content is de-identified: it is no longer connected to your name,
            photo, email, or sign-in.
          </p>
          <p>
            We also keep records we are required to retain for legal, tax, and
            accounting purposes, such as records of purchases. These are kept
            only for as long as the law requires and are not used to identify
            you.
          </p>
        </>
      ),
    },
    {
      id: "retention",
      title: "Timing and retention",
      body: (
        <p>
          Deletion takes effect immediately — your personal information is
          erased and your sessions revoked as soon as you confirm. Residual
          copies may persist in encrypted backups for up to 30 days, after which
          they are overwritten in the normal backup rotation.
        </p>
      ),
    },
    {
      id: "help",
      title: "Need help?",
      body: (
        <p>
          If you cannot access the app to delete your account, or you have a
          question about what happens to your data, write to{" "}
          <a
            className="text-rosegold hover:underline"
            href={`mailto:${PRIVACY_EMAIL}`}
          >
            {PRIVACY_EMAIL}
          </a>{" "}
          from the email address on the account and we will action the deletion
          for you.
        </p>
      ),
    },
  ];

  return (
    <LegalShell
      eyebrow="Your data"
      title="Delete your account"
      intro={`How to permanently delete your ${BRAND_NAME} account and personal data, what is erased, and what is kept.`}
      lastUpdated={LAST_UPDATED}
      sections={sections}
      crossLink={{ to: "/privacy", label: "Privacy Policy" }}
    />
  );
}
