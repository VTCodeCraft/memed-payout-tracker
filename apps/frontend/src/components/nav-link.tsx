"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A main-navigation item for AppShell's `nav`. The link for the current page is filled
 * and marked aria-current="page", so the active state does not rely on colour alone.
 */
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const active = usePathname() === href;

  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`inline-flex min-h-11 items-center rounded-full px-4 text-base font-medium ${
          active ? "bg-ink text-white" : "hover:bg-ink/5"
        }`}
      >
        {children}
      </Link>
    </li>
  );
}
