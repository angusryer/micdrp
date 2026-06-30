/** Profile DTO — 1:1 with a Supabase auth user. */
export interface ProfileDto {
  id: string;
  displayName: string | null;
  createdAtMs: number;
}
