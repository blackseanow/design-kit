// CSS compatibility check: doiuse reports every feature a kit stylesheet uses that
// a browser in .browserslistrc (docs/browser-support.md) does not fully support.
// Run from design-kit/:  node tests/compat_check.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import doiuse from "doiuse";
import browserslist from "browserslist";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATIC = join(ROOT, "design_kit", "static");
const browsers = browserslist(null, { path: ROOT });

// Reported by doiuse for the baseline, accepted on purpose. :has(), color-mix(),
// mask, dvh and the Popover API are inside the baseline and have their own
// fallbacks (docs/browser-support.md), so they do not appear here.
const IGNORE = [
  "css3-cursors",         // cursor values mean nothing on touch-only iOS
  "css-resize",           // textarea resize handle: iOS has none
  "css-clip-path",        // only .sr-only uses it, with the universally supported inset()
  "css-scrollbar",        // scrollbar-width / scrollbar-color are cosmetic
  "css-marker-pseudo",    // summary::marker colour is cosmetic
  "css-touch-action",     // desktop Safari has no touch; iOS Safari supports it
  "intrinsic-width",      // max-content is supported; the partial flag is about fit-content/stretch
  "css-display-contents", // used on a plain <div> (page title row on phones), not on a list
];

let findings = 0;
for (const name of readdirSync(STATIC).filter((file) => file.endsWith(".css")).sort()) {
  const file = join(STATIC, name);
  const css = readFileSync(file, "utf8");
  await postcss([
    doiuse({
      browsers,
      ignore: IGNORE,
      onFeatureUsage(usage) {
        findings += 1;
        const line = usage.usage.source?.start?.line ?? "?";
        console.log(`${name}:${line}  ${usage.feature}  ${usage.message.replace(/^.*?: /, "")}`);
      },
    }),
  ]).process(css, { from: file });
}
console.log(findings ? `${findings} CSS feature(s) outside the baseline (${browsers.length} browsers)` : `CSS fits the baseline (${browsers.length} browser versions checked)`);
process.exitCode = findings ? 1 : 0;
