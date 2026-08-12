import {
  AI_LAYOUT_CANDIDATE_PROFILE_IDS,
  type AiLayoutCandidate,
  type AiLayoutCandidateProfileId,
} from "@wechat-layout/api-contracts";

export const AI_LAYOUT_FAVORITES_STORAGE_KEY = "wechat-layout-ai-profile-favorites:v1";

const MAX_FAVORITES = AI_LAYOUT_CANDIDATE_PROFILE_IDS.length;

function isProfileId(value: unknown): value is AiLayoutCandidateProfileId {
  return (
    typeof value === "string" &&
    (AI_LAYOUT_CANDIDATE_PROFILE_IDS as readonly string[]).includes(value)
  );
}

export function parseAiLayoutFavorites(raw: string | null): readonly AiLayoutCandidateProfileId[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("version" in parsed) ||
      parsed.version !== 1 ||
      !("profileIds" in parsed) ||
      !Array.isArray(parsed.profileIds)
    ) {
      return [];
    }
    return [...new Set(parsed.profileIds.filter(isProfileId))].slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

export function serializeAiLayoutFavorites(
  profileIds: readonly AiLayoutCandidateProfileId[],
): string {
  return JSON.stringify({
    profileIds: [...new Set(profileIds.filter(isProfileId))].slice(0, MAX_FAVORITES),
    version: 1,
  });
}

export function toggleAiLayoutFavorite(
  profileIds: readonly AiLayoutCandidateProfileId[],
  profileId: AiLayoutCandidateProfileId,
): readonly AiLayoutCandidateProfileId[] {
  return profileIds.includes(profileId)
    ? profileIds.filter((candidate) => candidate !== profileId)
    : [...profileIds, profileId].slice(-MAX_FAVORITES);
}

export function orderAiLayoutCandidates(
  candidates: readonly AiLayoutCandidate[],
  favoriteProfileIds: readonly AiLayoutCandidateProfileId[],
): readonly AiLayoutCandidate[] {
  const favorites = new Map(favoriteProfileIds.map((profileId, index) => [profileId, index]));
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) => {
      const leftFavorite = favorites.get(left.candidate.profileId);
      const rightFavorite = favorites.get(right.candidate.profileId);
      if (leftFavorite !== undefined || rightFavorite !== undefined) {
        if (leftFavorite === undefined) return 1;
        if (rightFavorite === undefined) return -1;
        return leftFavorite - rightFavorite;
      }
      if (left.candidate.recommended !== right.candidate.recommended) {
        return left.candidate.recommended ? -1 : 1;
      }
      return left.index - right.index;
    })
    .map(({ candidate }) => candidate);
}
