import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/terms")({ component: Terms });

function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="September 29, 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) are a binding agreement between you and{" "}
        <strong>Kelnova Labs</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), the operator
        of the Kamino app and service (&quot;Kamino&quot;). By creating an account or using Kamino,
        you agree to these Terms. If you do not agree, do not use Kamino.
      </p>

      <h2>1. The service</h2>
      <p>
        Kamino is a community app: people create communities, post text, photos, polls and quizzes,
        chat, and play collaborative role-play stories. We provide the platform &quot;as is&quot;;
        the conversations and communities belong to their members, not to us.
      </p>

      <h2>2. Who may use Kamino</h2>
      <ul>
        <li>You must be at least 18 years old to use Kamino.</li>
        <li>You may only hold one account, registered with a valid email address you control.</li>
        <li>You are responsible for keeping your password secret and for everything done under your account.</li>
      </ul>

      <h2>3. Your content</h2>
      <ul>
        <li>
          <strong>You own what you post.</strong> By posting content on Kamino you grant us a
          worldwide, non-exclusive, royalty-free licence to store, display, distribute and
          technically process that content as needed to run the service (for example, showing your
          post to the audience you chose, or including it in your data export).
        </li>
        <li>
          <strong>You are responsible for your content.</strong> Only post things you have the right
          to share. Do not post other people&apos;s private information, copyrighted material you
          have no right to use, or content that is unlawful where you live.
        </li>
        <li>
          Role-play stories may be inspired by books, films or games, but you must write{" "}
          <strong>original prose only</strong> — never copy dialogue, lyrics or passages from
          existing works.
        </li>
      </ul>

      <h2>4. House rules</h2>
      <p>You must not, and must not allow others to, use Kamino to:</p>
      <ul>
        <li>Harass, threaten, bully or hate on any person or group.</li>
        <li>Share sexual content involving anyone under 18, or sexual content of any adult without their consent.</li>
        <li>Share instructions or encouragement for wrongdoing, weapons, drugs, hacking, fraud or self-harm.</li>
        <li>Run scams, spam, phishing, pyramid schemes or off-platform recruiting funnels.</li>
        <li>Impersonate another person, business or Kamino itself.</li>
        <li>Probe, attack or overload the service, or collect other members&apos; data by automated means.</li>
        <li>Circumvent a mute, ban or other moderation action (for example with a second account).</li>
      </ul>

      <h2>5. Moderation</h2>
      <ul>
        <li>
          Community leaders enforce their community&apos;s rules. They can hide content, mute or
          remove members, and issue strikes. Members can appeal from the community page.
        </li>
        <li>
          Automated safety checks scan content — including direct messages — for illegal or
          dangerous material. Flagged items go to a human review queue; nothing is banned
          automatically.
        </li>
        <li>
          We may, at our sole discretion and without prior notice, remove or restrict any content
          or suspend or terminate any account that we believe violates these Terms or harms the
          service or its members. We are not obliged to monitor everything posted.
        </li>
      </ul>

      <h2>6. AI features</h2>
      <ul>
        <li>
          Kamino offers AI features: an AI moderation check on shared content and an AI storyteller
          for role-play. AI output can be wrong, incomplete or nonsensical — do not rely on it for
          advice of any kind (medical, legal, financial or otherwise).
        </li>
        <li>
          No decision about your account is made by AI alone; a person always reviews flagged content.
        </li>
      </ul>

      <h2>7. Copyright</h2>
      <p>
        If you believe content on Kamino infringes your copyright, email{" "}
        <strong>info.kelnova@gmail.com</strong> with a description of the work, the location of the
        infringing material, and your contact details. We respond to valid notices and terminate
        repeat infringers.
      </p>

      <h2>8. No warranty</h2>
      <p>
        Kamino is provided <strong>&quot;as is&quot; and &quot;as available&quot;</strong>, without
        warranties of any kind, express or implied — including merchantability, fitness for a
        particular purpose, availability, security or freedom from errors. You use Kamino at your
        own risk.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Kelnova Labs and its owners, employees and agents
        are <strong>not liable</strong> for any indirect, incidental, special, consequential or
        punitive damages, or for any loss of data, profits or goodwill, arising from your use of
        (or inability to use) Kamino — even if we were told such damages were possible. Our total
        liability for any claim is limited to the amount you paid us for Kamino (Kamino is free, so
        this is zero) or CAD $50, whichever is greater, where the law requires a minimum.
      </p>

      <h2>10. Indemnity</h2>
      <p>
        You agree to indemnify and hold harmless Kelnova Labs and its owners, employees and agents
        from any claim, loss or expense (including reasonable legal fees) arising from your content,
        your use of Kamino, or your violation of these Terms.
      </p>

      <h2>11. Ending your account</h2>
      <p>
        You may delete your account at any time from Settings, which removes your profile, posts,
        comments, messages and follows (see the Privacy Policy for what moderation records we keep).
        We may suspend or delete accounts that break these Terms.
      </p>

      <h2>12. Changes</h2>
      <p>
        We may update these Terms; we will announce material changes in the app before they take
        effect. Continuing to use Kamino after a change means you accept the new Terms.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These Terms are governed by the laws of the Province of British Columbia and the federal
        laws of Canada. Any dispute will be resolved in the courts of British Columbia, and you
        consent to their jurisdiction.
      </p>

      <h2>14. General</h2>
      <p>
        If any part of these Terms is found unenforceable, the rest still applies. Our failure to
        enforce a provision is not a waiver of it. These Terms are the entire agreement between you
        and Kelnova Labs about Kamino.
      </p>

      <h2>15. Virtual coins</h2>
      <ul>
        <li>
          Kamino has a virtual currency called <strong>coins</strong>. Coins are earned through
          activity in the app (for example, daily check-ins) and cannot be purchased with real money.
        </li>
        <li>
          Coins have no monetary value, cannot be redeemed for cash, goods or services, and cannot
          be transferred outside Kamino. We may adjust coin balances, change how coins are earned,
          or remove the coins feature at any time.
        </li>
      </ul>
    </LegalPage>
  );
}
