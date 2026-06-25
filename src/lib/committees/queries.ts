import { applyCacheLife } from "@/lib/cache";
import { db } from "@/lib/db";

export type CommitteeTag = {
  code: string;
  name: string;
  chamber: string | null;
  type: string | null;
  role: string | null;
  isChair: boolean;
  isRanking: boolean;
};

export type CommitteeLookupInput = {
  name: string;
  state?: string | null;
  chamber?: string | null;
};

export async function getCommitteeTagsForPolitician({
  name,
  state,
  chamber,
}: CommitteeLookupInput): Promise<CommitteeTag[]> {
  "use cache";
  applyCacheLife("minutes");

  try {
    const politician = await db.politician.findFirst({
      where: {
        name,
        ...(state ? { state } : {}),
        ...(chamber ? { chamber } : {}),
      },
      include: {
        committees: {
          orderBy: [
            { isChair: "desc" },
            { isRanking: "desc" },
            { rank: "asc" },
          ],
          include: {
            committee: true,
          },
        },
      },
    });

    if (!politician) return [];

    return politician.committees.map((assignment) => ({
      code: assignment.committee.code,
      name: assignment.committee.name,
      chamber: assignment.committee.chamber,
      type: assignment.committee.type,
      role: assignment.role,
      isChair: assignment.isChair,
      isRanking: assignment.isRanking,
    }));
  } catch {
    return [];
  }
}

export function shortCommitteeName(name: string) {
  return name
    .replace(/^House Committee on /, "")
    .replace(/^Senate Committee on /, "")
    .replace(/^Committee on /, "")
    .replace(/^House Permanent Select Committee on /, "")
    .replace(/^Senate Select Committee on /, "")
    .replace(/^Joint Committee on /, "Joint ");
}
