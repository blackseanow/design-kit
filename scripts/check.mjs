// Runs every check the kit has, on this machine. There is no hosted CI.
//
//   npm run check                       Python tests, Node tests, compatibility lint,
//                                       browser checks in every installed engine
//   BROWSERS=chromium npm run check     only these engines (comma separated)
//   CHECK_REQUIRE_BROWSERS=1 ...        a missing engine fails instead of being skipped
//   PYTHON=python ...                   interpreter that has Flask (default python3)
//
// Engines are installed once with `npm run browsers`.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const playwright = require("playwright");

const root = fileURLToPath(new URL("..", import.meta.url));
const PYTHON = process.env.PYTHON || "python3";
const ENGINES = ["chromium", "webkit", "firefox"];
const requested = (process.env.BROWSERS || ENGINES.join(","))
  .split(",").map((name) => name.trim()).filter(Boolean);
const unknown = requested.filter((name) => !ENGINES.includes(name));
if (unknown.length) {
  console.error(`BROWSERS must be a subset of ${ENGINES.join(", ")}, not ${unknown.join(", ")}`);
  process.exit(2);
}
const requireBrowsers = process.env.CHECK_REQUIRE_BROWSERS === "1";
const eslint = path.join(root, "node_modules", "eslint", "bin", "eslint.js");

const steps = [
  { name: "Python 测试", cmd: PYTHON, args: ["-m", "unittest", "discover", "-s", "tests"] },
  { name: "Node 测试", cmd: process.execPath, args: ["--test", "tests/js/kit.test.js"] },
  { name: "CSS 兼容性（doiuse）", cmd: process.execPath, args: ["tests/compat_check.mjs"] },
  { name: "JS 兼容性（eslint-plugin-compat）", cmd: process.execPath, args: [eslint, "design_kit/static"] },
  ...requested.map((engine) => ({
    name: `浏览器检查（${engine}）`,
    cmd: process.execPath,
    args: ["tests/browser_check.js"],
    env: { BROWSER: engine, PYTHON },
    installed: () => existsSync(playwright[engine].executablePath()),
  })),
];

const results = [];
for (const step of steps) {
  console.log(`\n=== ${step.name}`);
  if (step.installed && !step.installed()) {
    const status = requireBrowsers ? "FAIL" : "跳过";
    console.log(`${status}：引擎未安装，先运行 npm run browsers`);
    results.push({ name: step.name, status, detail: "引擎未安装" });
    continue;
  }
  const run = spawnSync(step.cmd, step.args, {
    cwd: root, stdio: "inherit", env: { ...process.env, ...(step.env || {}) },
  });
  if (run.error) {
    console.log(`FAIL：${run.error.message}`);
    results.push({ name: step.name, status: "FAIL", detail: run.error.message });
  } else if (run.status !== 0) {
    results.push({ name: step.name, status: "FAIL", detail: `退出码 ${run.status}` });
  } else {
    results.push({ name: step.name, status: "通过", detail: "" });
  }
}

console.log("\n=== 汇总");
for (const result of results) {
  console.log(`${result.status}  ${result.name}${result.detail ? `：${result.detail}` : ""}`);
}
const failed = results.filter((result) => result.status === "FAIL");
const skipped = results.filter((result) => result.status === "跳过");
if (skipped.length) console.log(`\n${skipped.length} 项跳过，不算通过：${skipped.map((result) => result.name).join("、")}`);
process.exit(failed.length ? 1 : 0);
