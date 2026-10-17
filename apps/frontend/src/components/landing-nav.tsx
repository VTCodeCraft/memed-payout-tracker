// In-page links to the landing page's sections. Hidden below 1024px: the wordmark, four
// links and the auth buttons only fit on one row from there, and the page is short enough
// to scroll on a phone.
const SECTIONS = [
  { label: "How it works", href: "#how-payouts-work" },
  { label: "For brands", href: "#for-brands" },
  { label: "For creators", href: "#for-creators" },
  { label: "FAQ", href: "#faq" },
];

export function LandingNav() {
  return (
    <nav aria-label="On this page" className="mr-2 hidden lg:block">
      <ul className="flex">
        {SECTIONS.map(({ label, href }) => (
          <li key={href}>
            <a href={href} className="inline-flex min-h-11 items-center rounded-full px-4 font-medium hover:bg-ink/5">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
