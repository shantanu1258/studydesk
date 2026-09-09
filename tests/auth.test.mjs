import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(
  new URL("../src/repositories/authRepository.ts", import.meta.url),
  "utf8",
);
const authScreen = readFileSync(
  new URL("../src/features/auth/AuthScreen.tsx", import.meta.url),
  "utf8",
);
const accountDialog = readFileSync(
  new URL("../src/features/account/AccountDialog.tsx", import.meta.url),
  "utf8",
);
const passwordInput = readFileSync(
  new URL("../src/components/ui/PasswordInput.tsx", import.meta.url),
  "utf8",
);

test("password recovery uses the Supabase recovery session flow", () => {
  assert.match(repository, /resetPasswordForEmail/);
  assert.match(repository, /PASSWORD_RECOVERY/);
  assert.match(repository, /updateUser\(\{ password \}\)/);
});

test("signup and password update forms require matching entries", () => {
  assert.match(authScreen, /name="confirmPassword"/);
  assert.match(authScreen, /The two passwords do not match/);
  assert.match(accountDialog, /name="confirmPassword"/);
  assert.match(accountDialog, /The two passwords do not match/);
});

test("account profiles support restricted profile-photo uploads", () => {
  assert.match(repository, /from\("profile-photos"\)/);
  assert.match(repository, /2 \* 1024 \* 1024/);
  assert.match(repository, /image\/jpeg/);
  assert.match(repository, /full_name: name/);
});

test("passwords can be revealed while profile email stays read-only", () => {
  assert.match(passwordInput, /visible \? "text" : "password"/);
  assert.match(passwordInput, /Show password/);
  assert.match(passwordInput, /Hide password/);
  assert.match(authScreen, /<PasswordInput/);
  assert.match(accountDialog, /<PasswordInput/);
  assert.doesNotMatch(accountDialog, /<input value=\{user\.email\}/);
});
