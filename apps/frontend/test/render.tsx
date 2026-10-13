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
