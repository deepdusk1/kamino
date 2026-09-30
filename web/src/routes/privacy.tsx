import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({ component: Privacy });

function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="September 2026">
      <p>
        Kamino is a community app. This page explains, in plain language, what we store and why.
        It is a starting point written for the app as built; have it reviewed for your region and
        your hosting setup before you publish.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: email address, display name and a password (stored only as a one-way hash).</li>
        <li>What you create: profile, posts, comments, polls, quiz answers, chat messages, photos, voice notes and videos you send.</li>
        <li>Activity that powers the app: communities you join, follows, blocks, reports, notifications and your reputation points.</li>
        <li>Your phone&apos;s push-notification address, only if you allow notifications.</li>
      </ul>
      <h2>What we do not do</h2>
      <ul>
        <li>We do not show ads and we do not sell your data.</li>
        <li>
          People do not read your private messages. Automatic safety checks do scan everything shared,
          direct messages included, for illegal or dangerous content. If one is paused, a moderator (or,
          for direct messages, the site owner) sees a short excerpt so a person can decide.
        </li>
        <li>Kamino does not track you across other apps or websites.</li>
      </ul>
      <h2>Who can see what</h2>
      <p>
        Posts in public communities are visible to anyone. Private communities, direct messages and
        private rooms are visible only to their members. Blocking someone hides their content from you.
      </p>
      <h2>Safety</h2>
      <p>
        Kamino is for people aged 13 and older. Community leaders can remove content, mute or remove
        members, and members can appeal. Some phrases are filtered automatically to stop scams and
        harmful content.
      </p>
      <h2>AI services</h2>
      <p>
        If this server has them switched on, Kamino uses two outside AI services. Text and pictures you
        share are sent to OpenAI's moderation service to check them for illegal or dangerous content.
        Role-play story turns are sent to an AI storyteller service (Groq by default) so it can continue
        the story. They receive only the content needed for that job, not your email address, and handle
        it under their own terms. Kamino does not use them for ads or profiling. No decision about your
        account is made by the AI alone: a person always decides.
      </p>
      <h2>Your choices</h2>
      <ul>
        <li>Download your content from Settings → Export my data.</li>
        <li>Delete your account and your content from Settings → Delete account, or see the <a href="/delete-account">account deletion page</a>.</li>
        <li>Turn notification types on or off in Settings.</li>
      </ul>
      <h2>Retention</h2>
      <p>
        When you delete your account we remove your profile, posts, comments, messages, follows and
        notifications. Moderation records that protect other members (such as a strike log without
        your content) may be kept.
      </p>
    </LegalPage>
  );
}
