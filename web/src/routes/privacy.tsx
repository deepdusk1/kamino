import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({ component: Privacy });

function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="September 29, 2026">
      <p>
        Kamino is operated by <strong>Kelnova Labs</strong> of Kelowna, British Columbia, Canada.
        This policy explains what personal information we collect, why, and what choices you have.
        Contact us any time at <strong>info.kelnova@gmail.com</strong>.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> email address, display name, and a password stored only
          as a one-way hash (we never see your password).
        </li>
        <li>
          <strong>What you create:</strong> profile, posts, comments, polls, quiz answers, chat
          messages, photos, voice notes and videos you share.
        </li>
        <li>
          <strong>Activity that runs the app:</strong> communities you join, follows, blocks,
          reports, notifications, reputation points and moderation strikes on your account.
        </li>
        <li>
          <strong>Device information:</strong> your phone&apos;s push-notification token, only if
          you allow notifications, so we can deliver them.
        </li>
        <li>
          <strong>Technical logs:</strong> basic server logs (such as request times and error
          traces) used to keep the service running and secure.
        </li>
      </ul>

      <h2>2. What we do NOT do</h2>
      <ul>
        <li>
          <strong>We do not sell your personal information</strong> and we do not share it with
          advertisers or data brokers. Kamino has no ads.
        </li>
        <li>We do not track you across other apps or websites.</li>
        <li>
          We do not use your content to train AI models. Content is sent to our AI sub-processors
          only to perform the specific job you asked for (see §4).
        </li>
      </ul>

      <h2>3. Why we use your information</h2>
      <ul>
        <li>To run your account and show your content to the audience you chose.</li>
        <li>To keep Kamino safe: automated checks and human review of reported or flagged content.</li>
        <li>To send notifications you asked for.</li>
        <li>To fix bugs, keep the service secure, and meet our legal obligations.</li>
      </ul>

      <h2>4. AI sub-processors</h2>
      <p>
        Where the server operator has switched them on, Kamino uses two outside AI services, and
        only the content needed for that job is sent:
      </p>
      <ul>
        <li>
          <strong>OpenAI moderation:</strong> text and images you share are checked for illegal or
          dangerous content. They do not receive your email address.
        </li>
        <li>
          <strong>Groq storyteller:</strong> role-play story turns are sent so the AI can continue
          the story. It does not receive your email address.
        </li>
      </ul>
      <p>
        These providers handle the data under their own terms and do not use it for advertising.
        No decision about your account is made by AI alone — a person always reviews flagged content.
      </p>

      <h2>5. Who can see what</h2>
      <ul>
        <li>Posts in public communities are visible to anyone, including people without an account.</li>
        <li>Private communities, direct messages and private rooms are visible only to their members.</li>
        <li>Blocking someone hides their content from you.</li>
        <li>
          Safety review: automatic checks scan everything shared, direct messages included, for
          illegal or dangerous content. If an item is flagged, a human moderator (or, for direct
          messages, the site owner) sees a short excerpt to decide. No person routinely reads your
          private messages.
        </li>
      </ul>

      <h2>6. How long we keep it</h2>
      <p>
        We keep your information while your account is active. When you delete your account we
        remove your profile, posts, comments, messages, follows and notifications. Minimal
        moderation records that protect other members (such as a strike log without your content)
        may be kept. Server logs are kept for a limited time for security and debugging.
      </p>

      <h2>7. Your rights</h2>
      <ul>
        <li>Export your content any time from Settings → Export my data.</li>
        <li>Delete your account and your content from Settings → Delete account, or see the <a href="/delete-account">account deletion page</a>.</li>
        <li>Turn notification types on or off in Settings.</li>
        <li>
          Ask us to access, correct or delete your personal information by emailing{" "}
          <strong>info.kelnova@gmail.com</strong> — we respond to requests under Canadian privacy
          law (including BC PIPA and PIPEDA).
        </li>
      </ul>

      <h2>8. Age requirement</h2>
      <p>
        Kamino is for adults aged 18 and older. We do not knowingly collect personal information
        from anyone under 18; if we learn we have, we delete it promptly.
      </p>

      <h2>9. Security</h2>
      <p>
        We use reasonable technical and organizational measures to protect your information —
        encrypted connections, hashed passwords, and access limited to what is needed. No system is
        perfectly secure, so we cannot guarantee absolute security.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update this policy and will announce material changes in the app before they take
        effect, with the new date shown above. Continuing to use Kamino means you accept the
        updated policy.
      </p>
    </LegalPage>
  );
}
