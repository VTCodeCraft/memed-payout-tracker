"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface NavLinkProps {
  href: string;
  /** Path prefixes that also belong to this destination, such as "/brand/campaigns/". */
  activeFor?: string[];
  children: ReactNode;
}

/**
 * A main-navigation item for AppShell's `nav`. The link for the current section is filled
 * and marked aria-current="page", so the active state does not rely on colour alone.
 * A campaign page keeps its list's link marked, so the header still says where you are.
 */
export function NavLink({ href, activeFor = [], children }: NavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href || activeFor.some((prefix) => pathname.startsWith(prefix));

  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`inline-flex min-h-11 items-center rounded-full px-4 text-base font-medium transition-colors duration-150 motion-reduce:transition-none ${
          active ? "bg-ink text-white" : "hover:bg-ink/5"
        }`}
      >
        {children}
      </Link>
    </li>
  );
}
