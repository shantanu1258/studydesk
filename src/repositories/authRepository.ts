import type { AuthChangeEvent, User } from "@supabase/supabase-js";
import { DEMO_USER } from "../config/constants";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "../infrastructure/supabase/client";
import type {
  AppUser,
  ProfileUpdateInput,
  SignInInput,
  SignUpInput,
  SignUpResult,
} from "../types/domain";
import {
  clearDemoSession,
  resolveDemoUser,
  saveDemoSession,
} from "./localStorageRepository";

function toAppUser(user?: User | null): AppUser | null {
  if (!user) return null;
  return {
    id: user.id,
    name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Owner",
    library: user.user_metadata?.library_name || "My Study Library",
    email: user.email || "",
    storage: "cloud",
    avatarUrl: user.user_metadata?.avatar_url || undefined,
  };
}

function passwordResetRedirectUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("reset-password", "1");
  return url.toString();
}

function clearPasswordResetUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("reset-password");
  url.hash = "";
  window.history.replaceState(
    null,
    document.title,
    `${url.pathname}${url.search}`,
  );
}

export const authRepository = {
  isCloudConfigured: isSupabaseConfigured,

  isPasswordRecoveryUrl() {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return query.has("reset-password") || hash.get("type") === "recovery";
  },

  onPasswordRecovery(callback: () => void) {
    if (!isSupabaseConfigured()) return () => undefined;
    const { data } = getSupabaseClient().auth.onAuthStateChange(
      (event: AuthChangeEvent) => {
        if (event === "PASSWORD_RECOVERY") callback();
      },
    );
    return () => data.subscription.unsubscribe();
  },

  async currentUser() {
    const demoUser = resolveDemoUser();
    if (demoUser?.id === DEMO_USER.id) return { ...DEMO_USER };
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error) throw error;
    return toAppUser(data.session?.user);
  },

  openDemo() {
    saveDemoSession(DEMO_USER.id);
    return { ...DEMO_USER };
  },

  async signIn(input: SignInInput) {
    if (!isSupabaseConfigured()) {
      throw new Error(
        "Connect Supabase before using a real account. You can use the demo now.",
      );
    }
    clearDemoSession();
    const { data, error } =
      await getSupabaseClient().auth.signInWithPassword(input);
    if (error) throw error;
    return toAppUser(data.user);
  },

  async requestPasswordReset(email: string) {
    if (!isSupabaseConfigured()) {
      throw new Error("Connect Supabase before resetting a real account.");
    }
    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(
      email,
      { redirectTo: passwordResetRedirectUrl() },
    );
    if (error) throw error;
  },

  async updatePassword(password: string) {
    if (!isSupabaseConfigured()) {
      throw new Error("Connect Supabase before resetting a real account.");
    }
    const client = getSupabaseClient();
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      if (/session missing|invalid.*token|expired/i.test(error.message)) {
        throw new Error(
          "This password reset link has expired or was already used. Request a new link.",
        );
      }
      throw error;
    }
    await client.auth.signOut({ scope: "local" });
    clearPasswordResetUrl();
  },

  async updateProfile(input: ProfileUpdateInput) {
    if (!isSupabaseConfigured()) {
      throw new Error("Profile changes require a cloud account.");
    }
    const client = getSupabaseClient();
    const { data: current, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    if (!current.user)
      throw new Error("Your session has expired. Log in again.");

    let avatarUrl = current.user.user_metadata?.avatar_url || null;
    const photoPath = `${current.user.id}/profile-photo`;
    if (input.removePhoto) {
      const { error } = await client.storage
        .from("profile-photos")
        .remove([photoPath]);
      if (error) throw error;
      avatarUrl = null;
    } else if (input.photo) {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(input.photo.type)
      ) {
        throw new Error("Choose a JPG, PNG, or WebP photo.");
      }
      if (input.photo.size > 2 * 1024 * 1024) {
        throw new Error("Profile photos must be 2 MB or smaller.");
      }
      const { error } = await client.storage
        .from("profile-photos")
        .upload(photoPath, input.photo, {
          upsert: true,
          contentType: input.photo.type,
          cacheControl: "3600",
        });
      if (error) throw error;
      const { data } = client.storage
        .from("profile-photos")
        .getPublicUrl(photoPath);
      avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
    }

    const name = input.name.trim();
    const { data, error } = await client.auth.updateUser({
      data: { full_name: name, avatar_url: avatarUrl },
    });
    if (error) throw error;
    const { error: profileError } = await client
      .from("profiles")
      .update({ full_name: name })
      .eq("id", current.user.id);
    if (profileError) throw profileError;
    const user = toAppUser(data.user);
    if (!user) throw new Error("Your profile could not be refreshed.");
    return user;
  },

  async changePassword(password: string) {
    if (!isSupabaseConfigured()) {
      throw new Error("Password changes require a cloud account.");
    }
    const { error } = await getSupabaseClient().auth.updateUser({ password });
    if (error) throw error;
  },

  async cancelPasswordRecovery() {
    if (isSupabaseConfigured()) {
      await getSupabaseClient().auth.signOut({ scope: "local" });
    }
    clearPasswordResetUrl();
  },

  async signUp(input: SignUpInput): Promise<SignUpResult> {
    if (!isSupabaseConfigured()) {
      throw new Error(
        "Connect Supabase before creating a real account. You can use the demo now.",
      );
    }

    clearDemoSession();
    const normalizedInvite = input.inviteCode?.trim().toUpperCase() || "";
    const client = getSupabaseClient();
    if (normalizedInvite) {
      const { data: inviteRows, error } = await client.rpc(
        "validate_library_invite",
        {
          p_code: normalizedInvite,
        },
      );
      if (error) throw error;
      if (!inviteRows?.[0]?.is_valid) {
        throw new Error(
          "That invitation code is invalid, expired, or has already been used.",
        );
      }
    }

    const returnUrl = `${window.location.origin}${window.location.pathname}`;
    const { data, error } = await client.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.name,
          library_name: input.library || "",
          seat_count: Number(input.seatCount) || 24,
          primary_color: input.primaryColor || "#334155",
          secondary_color: input.secondaryColor || "#E2E8F0",
          join_code: normalizedInvite,
        },
        emailRedirectTo: returnUrl,
      },
    });
    if (error) throw error;
    return {
      user: data.session ? toAppUser(data.user) : null,
      needsEmailConfirmation: !data.session,
    };
  },

  async signOut(user: AppUser | null) {
    clearDemoSession();
    if (user?.storage === "cloud" && isSupabaseConfigured()) {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw error;
    }
  },
};
