/**
 * A placeholder block in the shape of content that is still loading. It pulses gently,
 * and holds still for people who ask for reduced motion. Size it with `className`.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-lg bg-ink/[0.07] motion-safe:animate-pulse ${className}`.trim()} />;
}
