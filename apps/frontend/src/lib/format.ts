// Indian digit grouping (1,00,000) for both money and view counts, so the two read the
// same way side by side, as they do in the brief's example ladder.
const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const counts = new Intl.NumberFormat("en-IN");
// India time, so a campaign created late at night shows the day the brand saw.
const dates = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** ₹5,000 or ₹1,00,000. The API stores money as whole rupees. */
export function formatRupees(amount: number): string {
  return rupees.format(amount);
}

/** 1,00,000 */
export function formatViews(views: number): string {
  return counts.format(views);
}

/** 13 Oct 2026, from an ISO timestamp such as a campaign's createdAt. */
export function formatDate(iso: string): string {
  return dates.format(new Date(iso));
}
