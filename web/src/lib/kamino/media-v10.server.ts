import type { Sql } from "../db";

/** Library files are private unless an administrator has supplied a licensed music catalog entry. */
export async function readableLibraryMedia(sql: Sql, userId: string, libraryId: number) {
  const rows = await sql`select * from media_library where id=${libraryId} and (owner_id=${userId} or licensed=true)`;
  if (!rows.length) throw new Error("Library media unavailable.");
  return rows[0]!;
}
