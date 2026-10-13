// Loaded with `node --import` before any test file (see the "test" script).
import { register } from "node:module";

register("./tsx-loader.mjs", import.meta.url);
