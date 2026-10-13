import { type ReactNode, act } from "react";
import { createRoot } from "react-dom/client";

/** Renders `ui` into a fresh container in the document and waits for effects to run. */
export async function render(ui: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Lets pending promises (such as stubbed API responses) settle and React re-render. */
export async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

export async function click(element: Element | null | undefined) {
  if (!(element instanceof HTMLElement)) throw new Error("click needs an element");
  await act(async () => element.click());
}

/** Types into a controlled input the way a browser does: React only sees native input events. */
export async function typeInto(input: Element | null | undefined, value: string) {
  if (!(input instanceof HTMLInputElement)) throw new Error("typeInto needs an <input>");
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
