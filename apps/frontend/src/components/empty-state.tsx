import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  children: ReactNode;
  /** The one thing to do next, such as a button or link. */
  action?: ReactNode;
  /** 3 when the empty list sits under its own section heading. */
  headingLevel?: 2 | 3;
}

/**
 * What a list shows before it has anything in it: what will appear here, and the next
 * step. The dashed border marks a space waiting to be filled rather than a finished card.
 */
export function EmptyState({ title, children, action, headingLevel = 2 }: EmptyStateProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-ink/30 bg-white px-6 py-8 md:px-8 md:py-10">
      <Heading className="text-xl font-semibold tracking-tight">{title}</Heading>
      <div className="max-w-prose text-muted text-pretty">{children}</div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
