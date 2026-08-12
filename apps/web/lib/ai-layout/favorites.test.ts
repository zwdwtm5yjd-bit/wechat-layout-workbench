import type { AiLayoutCandidate } from "@wechat-layout/api-contracts";
import { describe, expect, it } from "vitest";

import {
  orderAiLayoutCandidates,
  parseAiLayoutFavorites,
  serializeAiLayoutFavorites,
  toggleAiLayoutFavorite,
} from "./favorites";

function candidate(
  profileId: AiLayoutCandidate["profileId"],
  recommended = false,
): AiLayoutCandidate {
  return {
    candidateId: profileId,
    decision: {} as AiLayoutCandidate["decision"],
    differenceHighlights: [],
    profileId,
    recommended,
    structureLabel: profileId,
  };
}

describe("AI layout favorites", () => {
  it("recovers from corrupted or obsolete storage", () => {
    expect(parseAiLayoutFavorites("broken-json")).toEqual([]);
    expect(parseAiLayoutFavorites(JSON.stringify({ version: 2, profileIds: [] }))).toEqual([]);
    expect(
      parseAiLayoutFavorites(
        JSON.stringify({
          version: 1,
          profileIds: ["documentary-visual", "invalid", "documentary-visual"],
        }),
      ),
    ).toEqual(["documentary-visual"]);
  });

  it("round trips stable profile ids and toggles them", () => {
    const selected = toggleAiLayoutFavorite([], "minimal-longread");
    expect(parseAiLayoutFavorites(serializeAiLayoutFavorites(selected))).toEqual([
      "minimal-longread",
    ]);
    expect(toggleAiLayoutFavorite(selected, "minimal-longread")).toEqual([]);
  });

  it("puts browser favorites first without losing server order", () => {
    const candidates = [
      candidate("editorial-index", true),
      candidate("briefing-cards"),
      candidate("documentary-visual"),
    ];
    expect(
      orderAiLayoutCandidates(candidates, ["documentary-visual"]).map((item) => item.profileId),
    ).toEqual(["documentary-visual", "editorial-index", "briefing-cards"]);
  });
});
