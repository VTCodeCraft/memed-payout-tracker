import Link from "next/link";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  /** A small lowercase label above the title, naming the area of the app. */
  eyebrow?: string;
  /** A link back to the list this page belongs to; rendered first, above the title. */
  back?: { href: string; label: string };
  /** Badges or facts that belong with the title, such as platform and status. */
  meta?: ReactNode;
  description?: ReactNode;
  /** The page's main actions, aligned with the title on wide screens. */
  actions?: ReactNode;
}

/** The top of every signed-in page, so titles, back links and actions sit in the same place on each. */
export function PageHeader({ title, eyebrow, back, meta, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-muted hover:text-ink"
          >
            <span aria-hidden="true">←</span>
            {back.label}
          </Link>
        )}
        {eyebrow && <p className="text-sm font-medium lowercase text-muted">{eyebrow}</p>}
        <h1 className={`${eyebrow ? "mt-2" : ""} text-3xl font-semibold tracking-tight text-balance md:text-4xl`}>{title}</h1>
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
        {description && <div className="mt-3 max-w-2xl text-muted text-pretty">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
