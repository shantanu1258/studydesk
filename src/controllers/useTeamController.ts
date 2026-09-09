import { useCallback, useEffect, useState } from "react";
import { teamRepository } from "../repositories/teamRepository";
import type { LibraryInvite, TeamMember } from "../types/domain";

export function useTeamController(
  libraryId: string | undefined,
  enabled: boolean,
) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invite, setInvite] = useState<LibraryInvite | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled || !libraryId) return;
    let active = true;
    teamRepository
      .list(libraryId)
      .then((users) => active && setMembers(users))
      .catch(
        () =>
          active &&
          setError("Team access will be ready after the database update."),
      );
    return () => {
      active = false;
    };
  }, [enabled, libraryId]);

  const createInvite = useCallback(async () => {
    if (!libraryId) return null;
    setBusy(true);
    setError("");
    try {
      const created = await teamRepository.createInvite(libraryId);
      setInvite(created);
      return created;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The invitation code could not be created.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }, [libraryId]);

  const removeUser = useCallback(
    async (target: TeamMember) => {
      if (!libraryId) return false;
      setBusy(true);
      setError("");
      try {
        await teamRepository.removeUser(libraryId, target.id);
        setMembers((current) =>
          current.filter((member) => member.id !== target.id),
        );
        return true;
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "That user could not be removed.",
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [libraryId],
  );

  return { members, invite, error, busy, createInvite, removeUser };
}
