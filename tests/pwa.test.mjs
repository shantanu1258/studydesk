import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { webAppManifest as manifest } from "../src/pwa/manifest.ts";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const pwaRegistration = readFileSync(
  new URL("../src/infrastructure/pwa/registerPwa.ts", import.meta.url),
  "utf8",
);
const installUi = readFileSync(
  new URL("../src/components/pwa/InstallApp.tsx", import.meta.url),
  "utf8",
);
const viteConfig = readFileSync(
  new URL("../vite.config.ts", import.meta.url),
  "utf8",
);

test("Vite manages the React application and production build", () => {
  assert.match(packageJson.scripts.build, /vite build/);
  assert.match(packageJson.scripts.build, /tsc --noEmit/);
  assert.equal(packageJson.dependencies.react, "18.3.1");
  assert.equal(packageJson.dependencies["@supabase/supabase-js"], "2.78.0");
  assert.equal(packageJson.devDependencies.vite, "6.4.3");
  assert.match(index, /type="module" src="\/src\/main\.tsx"/);
  assert.doesNotMatch(index, /vendor\//);
});

test("web app manifest has the required install metadata and icons", () => {
  assert.equal(manifest.name, "StudyDesk — Reading Room Manager");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.prefer_related_applications, false);

  for (const size of ["192x192", "512x512"]) {
    const icon = manifest.icons.find(
      (candidate) => candidate.sizes === size && candidate.purpose === "any",
    );
    assert.ok(icon, `manifest should include a ${size} icon`);
    assert.ok(
      existsSync(new URL(`../public/${icon.src}`, import.meta.url)),
      `${icon.src} should exist`,
    );
  }

  const maskable = manifest.icons.find(
    (icon) => icon.sizes === "512x512" && icon.purpose === "maskable",
  );
  assert.ok(maskable, "manifest should include a maskable 512x512 icon");
  assert.ok(
    existsSync(new URL(`../public/${maskable.src}`, import.meta.url)),
    `${maskable.src} should exist`,
  );
});

test("Vite generates and registers the offline application shell", () => {
  assert.match(viteConfig, /VitePWA/);
  assert.match(viteConfig, /globPatterns/);
  assert.match(pwaRegistration, /virtual:pwa-register/);
  assert.match(index, /rel="apple-touch-icon"/);
});

test("install help includes instructions for both mobile platforms", () => {
  assert.match(installUi, /iPhone & iPad/);
  assert.match(installUi, /Android/);
  assert.match(installUi, /Use Safari/);
  assert.match(installUi, /Use Chrome/);
});
