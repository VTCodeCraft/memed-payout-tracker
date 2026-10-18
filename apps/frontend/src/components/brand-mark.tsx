/** The Meme'd "m" on a purple square, as in the favicon (app/icon.svg). Decorative: pair it with the wordmark or a heading. */
export function BrandMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={`shrink-0 ${className}`}>
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <path
        d="M9 22V14a3.5 3.5 0 0 1 7 0v8m0-8a3.5 3.5 0 0 1 7 0v8"
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
