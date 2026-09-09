import { useCallback, useEffect, useRef, useState } from "react";
import { authRepository } from "../repositories/authRepository";
import type {
  AppUser,
  ProfileUpdateInput,
  SignInInput,
  SignUpInput,
} from "../types/domain";

export function useAuthController() {
  const startsInPasswordRecovery = authRepository.isPasswordRecoveryUrl();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [passwordRecovery, setPasswordRecovery] = useState(
    startsInPasswordRecovery,
  );
  const passwordRecoveryRef = useRef(startsInPasswordRecovery);

  useEffect(() => {
    let active = true;
    const stopListening = authRepository.onPasswordRecovery(() => {
      if (!active) return;
      passwordRecoveryRef.current = true;
      setPasswordRecovery(true);
      setUser(null);
      setError("");
      setLoading(false);
    });
    authRepository
      .currentUser()
      .then((currentUser) => {
        if (active && !passwordRecoveryRef.current) setUser(currentUser);
      })
      .catch(
        (reason: Error) =>
          active &&
          setError(reason.message || "Could not restore your session."),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      stopListening();
    };
  }, []);

  const signIn = useCallback(async (input: SignInInput) => {
    const currentUser = await authRepository.signIn(input);
    setUser(currentUser);
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const result = await authRepository.signUp(input);
    if (result.user) setUser(result.user);
    return result;
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await authRepository.requestPasswordReset(email);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    await authRepository.updatePassword(password);
    passwordRecoveryRef.current = false;
    setPasswordRecovery(false);
    setUser(null);
  }, []);

  const cancelPasswordRecovery = useCallback(async () => {
    await authRepository.cancelPasswordRecovery();
    passwordRecoveryRef.current = false;
    setPasswordRecovery(false);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (input: ProfileUpdateInput) => {
    const updated = await authRepository.updateProfile(input);
    setUser(updated);
  }, []);

  const changePassword = useCallback(async (password: string) => {
    await authRepository.changePassword(password);
  }, []);

  const openDemo = useCallback(() => setUser(authRepository.openDemo()), []);

  const signOut = useCallback(async () => {
    try {
      await authRepository.signOut(user);
    } finally {
      setUser(null);
      setError("");
    }
  }, [user]);

  return {
    user,
    loading,
    error,
    cloudConfigured: authRepository.isCloudConfigured(),
    passwordRecovery,
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    cancelPasswordRecovery,
    updateProfile,
    changePassword,
    openDemo,
    signOut,
  };
}
