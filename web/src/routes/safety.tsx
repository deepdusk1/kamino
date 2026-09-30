import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/safety")({ component: SafetyPage });

/** How Kamino keeps communities safe, in plain words, and where to find help. */
function SafetyPage() {
  return (
    <AppShell title="Safety">
      <article className="mx-auto max-w-2xl space-y-5 px-4 py-6 text-sm leading-relaxed">
        <section className="glass-card rounded-2xl p-4">
          <h2 className="font-display text-lg font-semibold">If things feel heavy</h2>
          <p className="mt-2">
            You don't have to go through it alone. Talk to someone you trust, or contact a local
            crisis line. In Canada you can call or text 9-8-8; in the US, call or text 988. If you
            are in danger right now, call your local emergency number.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold">House rules</h2>
          <p className="mt-2">
            No ads, no coins, nothing for sale. Kamino is for people aged 13 and up. No sexual
            content involving minors, no selling drugs, weapons or stolen goods, no threats, no
            hate, no scams.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold">How moderation works</h2>
          <p className="mt-2">
            Everything shared is checked by built-in safety rules and, when the server has it
            switched on, a free AI safety check. When something looks illegal or dangerous it is
            paused ("held") and a moderator decides whether to put it back or remove it. The machine
            never bans anyone: people decide. You can always report anything with the Report button.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold">Role-play stories</h2>
          <p className="mt-2">
            The AI storyteller writes original, teen-safe stories inspired by the books and films
            you love. It does not copy lines or lyrics from them. Its writing goes through the same
            safety check as everyone else's.
          </p>
        </section>
      </article>
    </AppShell>
  );
}
