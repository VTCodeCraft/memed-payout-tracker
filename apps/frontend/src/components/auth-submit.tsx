import { Button } from "@/components/button";

interface AuthSubmitProps {
  label: string;
  pendingLabel: string;
  pending: boolean;
  /** The request has been waiting long enough that the server is probably waking up. */
  slow: boolean;
}

/** The submit button for the login and signup forms, with a note when the server is slow. */
export function AuthSubmit({ label, pendingLabel, pending, slow }: AuthSubmitProps) {
  return (
    <div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? pendingLabel : label}
      </Button>
      {/* Always rendered: a live region must exist before its text changes to be announced. */}
      <p role="status" className="mt-2 text-sm text-muted">
        {slow ? "Still working. The server sleeps when idle and can take up to a minute to wake up." : ""}
      </p>
    </div>
  );
}
