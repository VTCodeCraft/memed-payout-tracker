import { LandingSection } from "@/components/landing-section";

// Each line is something the API enforces and its tests check (see the README's
// "Payout rules" and "Why view updates use a transaction").
const GUARANTEES = [
  {
    title: "Payout and spend change together",
    body: "A post's payout and the campaign's spend are written in one database transaction, so one never changes without the other.",
  },
  {
    title: "Simultaneous updates can't overspend",
    body: "When two view updates compete for the same budget, the later one sees the earlier one's change and retries instead of spending the same money twice.",
  },
  {
    title: "No post is paid twice",
    body: "A post is only paid the gap between its highest milestone and what it already received. The same link can't be submitted again, even to another campaign.",
  },
  {
    title: "The budget is a hard cap",
    body: "Spend never passes the budget. The post that uses up the last of it gets what is left, and the rest is recorded as unfunded.",
  },
  {
    title: "Fast growth is flagged, not punished",
    body: "A post gaining 10,000 views or more an hour is flagged on its record for a person to review. The flag never changes what the post is paid.",
  },
  {
    title: "View counts never go down",
    body: "A count lower than the last one recorded is rejected, so the numbers behind every payout only move forward.",
  },
];

export function Guarantees() {
  return (
    <LandingSection id="guarantees" title="Built to be trusted" intro="Rules the payout engine enforces on every update.">
      <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {GUARANTEES.map(({ title, body }) => (
          <div key={title} className="border-t border-ink/10 pt-4">
            <dt className="font-semibold">{title}</dt>
            <dd className="mt-1 text-muted text-pretty">{body}</dd>
          </div>
        ))}
      </dl>
    </LandingSection>
  );
}
