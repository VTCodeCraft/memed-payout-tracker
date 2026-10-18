import { BrandMark } from "@/components/brand-mark";
import { apiUrl } from "@/lib/api-url";

const REPO_URL = "https://github.com/VTCodeCraft/memed-payout-tracker";

// The API link follows NEXT_PUBLIC_API_URL, so it points at Render in production and at
// the local API in development.
const LINKS = [
  { label: "Source on GitHub", href: REPO_URL },
  { label: "README", href: `${REPO_URL}#readme` },
  { label: "API status", href: apiUrl("health") },
];

export function LandingFooter() {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <p className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <BrandMark />
        <span>
          meme&apos;d <span className="font-medium text-muted">payouts</span>
        </span>
      </p>
      <nav aria-label="Project">
        <ul className="flex flex-wrap gap-x-6">
          {LINKS.map(({ label, href }) => (
            <li key={label}>
              <a href={href} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4 hover:text-brand">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
