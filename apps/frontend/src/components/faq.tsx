import { LandingSection } from "@/components/landing-section";

// Answers follow the README's "Payout rules", "Decisions and assumptions" and "Limitations".
const QUESTIONS = [
  {
    question: "Who pays the creators?",
    answer:
      "The brand. It sets each campaign's budget, and every payout comes out of it. The tracker records what each post earned and was paid; it doesn't connect to a bank or payment provider.",
  },
  {
    question: "What counts as a view?",
    answer:
      "The view count recorded for the post. There is no direct Instagram or YouTube connection: counts are reported to an update endpoint that stands in for the platform's data. A count can only go up.",
  },
  {
    question: "What happens when the budget runs out?",
    answer:
      "The post that reaches the end of it is paid what is left, and the rest of what it earned is recorded as unfunded. The campaign is marked Budget exhausted, leaves the live list and stops taking posts. Budgets can't be topped up, so unfunded amounts are never paid later.",
  },
  {
    question: "Can a post earn twice?",
    answer:
      "No. Milestones replace each other instead of adding up: a post that passes 10,000 and then 50,000 views earns ₹2,000 in total, not ₹2,500. Reporting the same count again pays nothing, and a link can only be submitted once across all campaigns.",
  },
  {
    question: "Instagram or YouTube?",
    answer:
      "Each campaign is for one platform, chosen when it is created. Instagram campaigns take post and reel links; YouTube campaigns take video, Shorts and youtu.be links. Different links to the same post count as one post.",
  },
  {
    question: "Can a brand change a campaign after it starts?",
    answer:
      "No. The budget and milestones are fixed once a campaign is created, because creators post on the strength of them.",
  },
];

/** Questions beside their answers, all visible: there are few enough that hiding them helps no one. */
export function Faq() {
  return (
    <LandingSection id="faq" title="Questions" intro="Short answers about money, views and limits.">
      <dl className="divide-y divide-ink/10 border-y border-ink/10">
        {QUESTIONS.map(({ question, answer }) => (
          <div key={question} className="grid gap-2 py-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-8">
            <dt className="font-semibold text-pretty">{question}</dt>
            <dd className="text-muted text-pretty">{answer}</dd>
          </div>
        ))}
      </dl>
    </LandingSection>
  );
}
