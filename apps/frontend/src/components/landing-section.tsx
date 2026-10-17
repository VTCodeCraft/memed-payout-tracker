import type { ReactNode } from "react";

interface LandingSectionProps {
  /** The in-page anchor, such as "faq"; the heading's id is derived from it. */
  id: string;
  title: string;
  intro: string;
  children: ReactNode;
}

/**
 * A landing page section under a full-width rule: the heading and a short intro on the
 * left, the content on the right. On phones they stack.
 */
export function LandingSection({ id, title, intro, children }: LandingSectionProps) {
  const titleId = `${id}-title`;

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className="mt-12 grid scroll-mt-8 gap-8 border-t border-ink pt-10 md:mt-20 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-16 md:pt-12"
    >
      <div>
        <h2 id={titleId} className="text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h2>
        <p className="mt-3 max-w-xs text-muted text-pretty">{intro}</p>
      </div>
      {children}
    </section>
  );
}
