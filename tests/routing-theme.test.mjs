import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const packageJson = JSON.parse(read("package.json"));
const main = read("src/main.tsx");
const workspace = read("src/components/layout/WorkspaceShell.tsx");
const modal = read("src/components/ui/Modal.tsx");
const header = read("src/components/layout/PageHeader.tsx");
const theme = read("src/context/ThemeContext.tsx");
const index = read("index.html");
const wrangler = read("wrangler.jsonc");

test("workspace pages use browser routes with SPA refresh fallback", () => {
  assert.equal(packageJson.dependencies["react-router-dom"], "6.30.4");
  assert.match(main, /<BrowserRouter>/);
  for (const path of [
    "/members",
    "/fees",
    "/search",
    "/attendance",
    "/settings",
  ]) {
    assert.match(workspace, new RegExp(`path="${path}"`));
  }
  assert.match(workspace, /<NavLink/);
  assert.match(wrangler, /"not_found_handling": "single-page-application"/);
});

test("search close returns through browser history with a direct-load fallback", () => {
  assert.match(workspace, /navigate\(-1\)/);
  assert.match(workspace, /state: \{ from: location\.pathname \}/);
  assert.match(
    workspace,
    /navigate\(VIEW_PATHS\.overview, \{ replace: true \}\)/,
  );
});

test("the shared modal wrapper closes every modal through browser history", () => {
  assert.match(main, /<ModalHistoryProvider>/);
  assert.match(modal, /history\.pushState/);
  assert.match(modal, /addEventListener\("popstate", handleBack\)/);
  assert.match(modal, /registration\.close\(\)/);
  assert.match(modal, /registrations\.current\.length/);
  assert.match(workspace, /workspaceModalStack/);
  assert.match(
    workspace,
    /const workspaceModal = workspaceModalStack\.at\(-1\)/,
  );
  assert.match(workspace, /sameModal\(stack\.at\(-2\), next\)/);
  assert.match(workspace, /setModal=\{setWorkspaceModal\}/);
});

test("light mode is the default and an explicit choice persists", () => {
  assert.doesNotMatch(theme, /prefers-color-scheme: dark/);
  assert.match(theme, /localStorage\.getItem\(THEME_STORAGE_KEY\)/);
  assert.match(theme, /saveTheme\(next\)/);
  assert.match(index, /studydesk-color-theme/);
  assert.match(index, /name="color-scheme" content="light dark"/);
  assert.match(header, /<ThemeToggle/);
});

test("installed-app browser chrome follows the configured header color", () => {
  assert.match(workspace, /setBrowserThemeColor\(color\)/);
  assert.match(workspace, /settings\.primaryColor/);
});
