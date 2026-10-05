import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/terms")({ component: Terms });

function Terms() {
  return (
    <LegalPage title="Terms of use" updated="September 2026">
      <p>
        By using Kamino you agree to these rules. They are short on purpose. Have them reviewed
        before you publish the app.
      </p>
      <h2>House laws</h2>
      <ul>
        <li>Be kind. No harassment, hate, threats or sexual content involving minors — ever.</li>
        <li>No scams, spam, off-platform recruiting or trading of explicit images.</li>
        <li>You own what you post, and you let Kamino show it to the audience you choose.</li>
        <li>Only post what you have the right to share.</li>
        <li>Kamino is free to use. If optional paid features are ever added, they will be explained here first and are never needed to take part.</li>
      </ul>
      <h2>Age</h2>
      <p>You must be at least 13 to use Kamino. Some communities set a higher age.</p>
      <h2>Moderation</h2>
      <p>
        Community leaders and curators enforce each community&apos;s rules. They can hide content,
        mute members for a set time, issue strikes and remove members. Three strikes remove a member
        from that community. You can appeal any of these from the community page.
      </p>
      <h2>Reporting</h2>
      <p>
        Use Report on any post, comment or message. You can also block people at any time. To report
        something urgent, email us using the address below.
      </p>
      <h2>Changes and ending</h2>
      <p>
        We may update these terms; we will say so in the app. You can delete your account at any
        time. We may remove accounts that break the house laws.
      </p>
    </LegalPage>
  );
}
