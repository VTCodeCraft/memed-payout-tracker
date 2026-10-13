/**
 * Moves keyboard focus to the first field (in `order`) that has a problem, so keyboard
 * and screen-reader users land on what needs fixing. Radio groups focus their first option.
 */
export function focusFirstProblem(form: HTMLFormElement, order: readonly string[], problems: Record<string, string>) {
  const name = order.find((field) => problems[field]);
  if (!name) return;
  const element = form.elements.namedItem(name);
  const target = element instanceof RadioNodeList ? element[0] : element;
  if (target instanceof HTMLElement) target.focus();
}
