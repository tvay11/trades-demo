import { cacheLife, cacheTag, revalidateTag } from "next/cache";

type CacheProfile = "minutes" | "hours";
type RevalidateProfile = Parameters<typeof revalidateTag>[1];

function isNextCacheDisabled() {
  return process.env.TRADES_DISABLE_NEXT_CACHE === "1";
}

export function applyCacheLife(profile: CacheProfile) {
  if (isNextCacheDisabled()) return;

  try {
    if (profile === "minutes") {
      cacheLife("minutes");
      return;
    }

    cacheLife("hours");
  } catch (error) {
    if (process.env.NODE_ENV === "test") return;
    throw error;
  }
}

export function applyCacheTag(...tags: string[]) {
  if (isNextCacheDisabled()) return;

  try {
    cacheTag(...tags);
  } catch (error) {
    if (process.env.NODE_ENV === "test") return;
    throw error;
  }
}

export function revalidateCacheTag(tag: string, profile: RevalidateProfile) {
  if (isNextCacheDisabled()) return;

  try {
    revalidateTag(tag, profile);
  } catch (error) {
    if (process.env.NODE_ENV === "test") return;
    throw error;
  }
}
