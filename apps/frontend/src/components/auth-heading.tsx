import { BrandMark } from "@/components/brand-mark";

/** The top of the login and signup pages: the mark, the page's title and one line on what it is for. */
export function AuthHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <BrandMark className="size-12" />
      <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-2 max-w-sm text-muted text-pretty">{description}</p>
    </div>
  );
}
