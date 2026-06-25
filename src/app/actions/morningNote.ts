"use server";

import { revalidatePath } from "next/cache";
import { regenerateMorningNote } from "@/lib/brief/generateMorningNote";

export async function regenerateMorningNoteAction(): Promise<{ ok: boolean }> {
  const result = await regenerateMorningNote();
  revalidatePath("/");
  return { ok: result !== null };
}
