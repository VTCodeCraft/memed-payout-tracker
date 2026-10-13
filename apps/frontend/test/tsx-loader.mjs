// Node module hooks that let `node --test` load what Next.js handles inside the app:
// `.tsx` files (compiled with the TypeScript already installed for type checking) and
// the "@/..." import alias from tsconfig.json. Nothing is bundled or type-checked here;
// `pnpm typecheck` checks the test files like any other source.
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SRC = new URL("../src/", import.meta.url);
const CANDIDATES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

async function isFile(url) {
  try {
    return (await stat(url)).isFile();
  } catch {
    return false;
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = new URL(specifier.slice(2), SRC).href;
    for (const suffix of CANDIDATES) {
      const url = new URL(base + suffix);
      if (await isFile(url)) return { url: url.href, shortCircuit: true };
    }
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    // Packages without an "exports" map, such as next ("next/link"), rely on CommonJS-style
    // extension lookup, which Node's ESM resolver does not do.
    const bareSubpath = /^[^./][^:]*\/[^/]+$/.test(specifier) && !specifier.endsWith(".js");
    if (error?.code !== "ERR_MODULE_NOT_FOUND" || !bareSubpath) throw error;
    return nextResolve(`${specifier}.js`, context);
  }
}

export async function load(url, context, nextLoad) {
  if (!url.startsWith("file:") || !url.endsWith(".tsx")) return nextLoad(url, context);
  const fileName = fileURLToPath(url);
  const { outputText } = ts.transpileModule(await readFile(fileName, "utf8"), {
    fileName,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return { format: "module", source: outputText, shortCircuit: true };
}
