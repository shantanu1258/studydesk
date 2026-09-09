import { getSupabaseClient } from "../infrastructure/supabase/client";
import type { LibraryInvite, TeamMember } from "../types/domain";

function dataOrThrow<T>({
  data,
  error,
}: {
  data: T;
  error: { message: string } | null;
}) {
  if (error) throw error;
  return data;
}

export const teamRepository = {
  async list(libraryId: string): Promise<TeamMember[]> {
    const rows =
      dataOrThrow(
        await getSupabaseClient().rpc("list_library_users", {
          p_library_id: libraryId,
        }),
      ) || [];
    return rows.map((item: Record<string, string | boolean>) => ({
      id: String(item.user_id),
      name: String(item.full_name),
      email: String(item.email),
      founder: Boolean(item.is_founder),
      joinedAt: String(item.joined_at),
    }));
  },

  async createInvite(libraryId: string): Promise<LibraryInvite> {
    const rows = dataOrThrow(
      await getSupabaseClient().rpc("create_library_invite", {
        p_library_id: libraryId,
      }),
    );
    const invite = rows?.[0];
    if (!invite) throw new Error("The invitation code could not be created.");
    return { code: invite.invite_code, expiresAt: invite.expires_at };
  },

  async removeUser(libraryId: string, userId: string) {
    dataOrThrow(
      await getSupabaseClient().rpc("remove_library_user", {
        p_library_id: libraryId,
        p_user_id: userId,
      }),
    );
  },
};
