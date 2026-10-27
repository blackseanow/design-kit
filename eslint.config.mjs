// Compatibility lint for the kit's browser scripts: eslint-plugin-compat flags
// web APIs newer than the baseline in .browserslistrc. Style rules are not enforced here.
import compat from "eslint-plugin-compat";

export default [
  compat.configs["flat/recommended"],
  {
    files: ["design_kit/static/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        window: "readonly", document: "readonly", globalThis: "readonly", module: "writable", console: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly", requestAnimationFrame: "readonly", cancelAnimationFrame: "readonly",
        MutationObserver: "readonly", ResizeObserver: "readonly", CustomEvent: "readonly", Event: "readonly", Node: "readonly",
        HTMLElement: "readonly", getComputedStyle: "readonly", localStorage: "readonly", fetch: "readonly", location: "readonly",
      },
    },
    rules: {
      "compat/compat": "error",
    },
  },
];
