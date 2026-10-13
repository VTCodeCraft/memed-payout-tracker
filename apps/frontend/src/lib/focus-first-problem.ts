/**
 * Moves keyboard focus to the first field (in `order`) that has a problem, so keyboard
 * and screen-reader users land on what needs fixing. Radio groups focus their first option;
 * a problem with no focusable element of that name is skipped.
 */
export function focusFirstProblem(form: HTMLFormElement, order: readonly string[], problems: Record<string, string>) {
  for (const name of order) {
    if (!problems[name]) continue;
    const element = form.elements.namedItem(name);
    const target = element instanceof RadioNodeList ? element[0] : element;
    if (target instanceof HTMLElement) {
      target.focus();
      return;
    }
  }
}
