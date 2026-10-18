import Link from "next/link";
import type { ReactNode } from "react";

interface AppShellProps {
  /** Links for the signed-in role, rendered inside <nav>; omitted on public pages. */
  nav?: ReactNode;
  /** Right-hand header content, such as the signed-in user and sign-out. */
  actions?: ReactNode;
  /** Page footer content, rendered after <main> so it is the page's contentinfo landmark. */
  footer?: ReactNode;
  /** "canvas" puts the page on the off-white canvas, so white cards stand out; for the signed-in app. */
  background?: "white" | "canvas";
  children: ReactNode;
}

/**
 * Page frame: a top bar with the wordmark, optional navigation and actions, then the
 * page content. Each role has two or three destinations, so a top bar fits them; on
 * small screens the navigation wraps onto its own row instead of hiding in a menu.
 */
export function AppShell({ nav, actions, footer, background = "white", children }: AppShellProps) {
  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-full bg-ink text-white focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-10 focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-b border-ink bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 md:gap-x-8 md:px-8">
          {/* The suffix is dropped on phones so the actions stay on the wordmark's row. */}
          <Link href="/" className="text-xl font-bold tracking-tight">
            meme&apos;d <span className="hidden font-medium text-muted sm:inline">payouts</span>
          </Link>
          {nav && (
            <nav aria-label="Main" className="order-last w-full md:order-none md:w-auto">
              <ul className="flex gap-2">{nav}</ul>
            </nav>
          )}
          {actions && <div className="ml-auto flex items-center gap-3">{actions}</div>}
        </div>
      </header>
      <div className={`flex flex-1 flex-col ${background === "canvas" ? "bg-canvas" : ""}`}>
        <main id="main" className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 md:px-8 md:py-12">
          {children}
        </main>
      </div>
      {footer && (
        <footer className="border-t border-ink">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">{footer}</div>
        </footer>
      )}
    </>
  );
}
