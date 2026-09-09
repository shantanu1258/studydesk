import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Modal, ModalHeader } from "../../components/ui/Modal";
import { UploadIcon } from "../../components/ui/Icons";
import { PasswordInput } from "../../components/ui/PasswordInput";
import type { AppUser, ProfileUpdateInput } from "../../types/domain";
import { initials } from "../../utils/format";

const allowedPhotoTypes = ["image/jpeg", "image/png", "image/webp"];
const maximumPhotoSize = 2 * 1024 * 1024;

export function AccountDialog({
  user,
  onClose,
  onUpdateProfile,
  onChangePassword,
}: {
  user: AppUser;
  onClose: () => void;
  onUpdateProfile: (input: ProfileUpdateInput) => Promise<void>;
  onChangePassword: (password: string) => Promise<void>;
}) {
  const cloudAccount = user.storage === "cloud";
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [preview, setPreview] = useState(user.avatarUrl || "");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");

  useEffect(() => {
    if (removePhoto) {
      setPreview("");
      return;
    }
    if (!photo) {
      setPreview(user.avatarUrl || "");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo, removePhoto, user.avatarUrl]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError("");
    setProfileNotice("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) {
      setProfileError("Enter your full name.");
      return;
    }
    setProfileBusy(true);
    try {
      await onUpdateProfile({ name, photo, removePhoto });
      setPhoto(null);
      setRemovePhoto(false);
      setProfileNotice("Profile updated.");
    } catch (reason) {
      setProfileError(
        reason instanceof Error
          ? reason.message
          : "Your profile could not be updated.",
      );
    } finally {
      setProfileBusy(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordNotice("");
    const form = new FormData(event.currentTarget);
    const passwordForm = event.currentTarget;
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmPassword") || "");
    if (password !== confirmation) {
      setPasswordError("The two passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    try {
      await onChangePassword(password);
      passwordForm.reset();
      setPasswordNotice("Password updated.");
    } catch (reason) {
      setPasswordError(
        reason instanceof Error
          ? reason.message
          : "Your password could not be updated.",
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader
        eyebrow="Your account"
        title="Profile & security"
        text="Manage the details used for your StudyDesk account."
        onClose={onClose}
      />

      {!cloudAccount && (
        <p className="modal-note mb-5">
          This is a temporary demo account. Sign in to a cloud account to save
          profile or password changes.
        </p>
      )}

      <form className="grid gap-4" onSubmit={saveProfile}>
        <div className="flex flex-col gap-4 rounded-2xl bg-slate-100 p-4 sm:flex-row sm:items-center">
          <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[var(--brand,#334155)] text-xl font-extrabold text-[var(--button-text,#fff)]">
            {preview ? (
              <img
                src={preview}
                alt={`${user.name}'s profile`}
                className="size-full object-cover"
              />
            ) : (
              initials(user.name)
            )}
          </span>
          <div className="grid gap-2">
            <strong>Profile photo</strong>
            <p className="text-sm text-slate-600">
              JPG, PNG, or WebP. Maximum 2 MB.
            </p>
            {cloudAccount && (
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50">
                  <UploadIcon className="size-4" />
                  Choose photo
                  <input
                    type="file"
                    accept={allowedPhotoTypes.join(",")}
                    className="sr-only"
                    onChange={(event) => {
                      const selected = event.target.files?.[0] || null;
                      setProfileError("");
                      if (
                        selected &&
                        !allowedPhotoTypes.includes(selected.type)
                      ) {
                        setProfileError("Choose a JPG, PNG, or WebP photo.");
                        event.target.value = "";
                        return;
                      }
                      if (selected && selected.size > maximumPhotoSize) {
                        setProfileError(
                          "Profile photos must be 2 MB or smaller.",
                        );
                        event.target.value = "";
                        return;
                      }
                      setPhoto(selected);
                      setRemovePhoto(false);
                    }}
                  />
                </label>
                {(preview || user.avatarUrl) && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setPhoto(null);
                      setRemovePhoto(true);
                    }}
                  >
                    Remove photo
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <label>
          Full name
          <input
            name="name"
            autoComplete="name"
            maxLength={120}
            defaultValue={user.name}
            disabled={!cloudAccount}
            required
          />
        </label>
        <div className="grid gap-1.5">
          <span className="text-sm font-bold text-slate-700">
            Email address
          </span>
          <p className="break-all rounded-xl bg-slate-100 px-4 py-3 font-semibold text-slate-700">
            {user.email}
          </p>
        </div>
        {profileError && <p className="field-error">{profileError}</p>}
        {profileNotice && (
          <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            {profileNotice}
          </p>
        )}
        <Button
          type="submit"
          className="sm:justify-self-end"
          loading={profileBusy}
          loadingLabel="Saving profile…"
          disabled={!cloudAccount}
        >
          Save profile
        </Button>
      </form>

      <div className="my-6 border-t border-slate-200" />

      <form className="grid gap-4" onSubmit={savePassword}>
        <div>
          <h3 className="font-display text-xl font-bold text-slate-900">
            Change password
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Your current signed-in session verifies this change.
          </p>
        </div>
        <div className="form-grid">
          <label>
            New password
            <PasswordInput
              name="password"
              autoComplete="new-password"
              minLength={8}
              disabled={!cloudAccount}
              required
              placeholder="At least 8 characters"
            />
          </label>
          <label>
            Confirm new password
            <PasswordInput
              name="confirmPassword"
              autoComplete="new-password"
              minLength={8}
              disabled={!cloudAccount}
              required
              placeholder="Enter it again"
            />
          </label>
        </div>
        {passwordError && <p className="field-error">{passwordError}</p>}
        {passwordNotice && (
          <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            {passwordNotice}
          </p>
        )}
        <Button
          type="submit"
          className="sm:justify-self-end"
          loading={passwordBusy}
          loadingLabel="Updating password…"
          disabled={!cloudAccount}
        >
          Update password
        </Button>
      </form>
    </Modal>
  );
}
