import {
  buildAestheticAnalysis,
  defaultBodyProfile,
} from "../../src/lib/aestheticAnalysis";
import type {
  LocalSnapshot,
  LocalVisionPayload,
} from "../../src/lib/localAestheticLab";

const payload = (
  tags: Partial<
    Pick<
      LocalVisionPayload,
      "silhouetteTags" | "materialTags" | "styleTags" | "designHighlights"
    >
  > = {},
): LocalVisionPayload => ({
  silhouetteTags: tags.silhouetteTags || [],
  materialTags: tags.materialTags || [],
  patternTags: [],
  styleTags: tags.styleTags || [],
  designHighlights: tags.designHighlights || [],
  visualWeight: null,
  formality: null,
  dominantColors: [],
});

const confirmedTag = (value: string) => ({
  value,
  confidence: 1,
  evidence: "fixture",
  source: "user" as const,
});
const proposedTag = (value: string) => ({
  value,
  confidence: 0.6,
  evidence: "fixture",
  source: "vision_model" as const,
});

const snapshot: LocalSnapshot = {
  schemaVersion: "fixture-v1",
  exportedAt: "2026-07-19T00:00:00.000Z",
  wardrobeItems: [
    {
      id: "shirt",
      name: "Signature shirt",
      rating: 9,
      story: "I love the collar detail.",
    },
    { id: "trouser", name: "Neutral trouser", rating: 5 },
    {
      id: "unworn",
      name: "High-rated piece",
      rating: 10,
      story: "Gift from a friend.",
    },
  ],
  bestMatches: [
    {
      id: "match-1",
      name: "Bright balance",
      story:
        "Use the shirt detail as the focus and the trouser to keep the look quiet.",
      items: {
        tops: [{ primary: "shirt" }],
        bottoms: [{ primary: "trouser" }],
      },
    },
  ],
  visionAnalyses: [
    {
      id: "vision-shirt",
      itemId: "shirt",
      status: "confirmed",
      modelVersion: "fixture",
      updatedAt: "2026-07-19T00:00:00.000Z",
      payload: payload({
        silhouetteTags: [confirmedTag("cropped")],
        designHighlights: [confirmedTag("collar")],
      }),
    },
    {
      id: "vision-trouser",
      itemId: "trouser",
      status: "proposed",
      modelVersion: "fixture",
      updatedAt: "2026-07-19T00:00:00.000Z",
      payload: payload({ styleTags: [proposedTag("minimal")] }),
    },
  ],
};

const before = JSON.stringify(snapshot);
const bundle = buildAestheticAnalysis(snapshot, defaultBodyProfile());

if (JSON.stringify(snapshot) !== before)
  throw new Error("Analysis engine mutated the source snapshot.");
if (
  !bundle.evidence.some(
    (entry) => entry.status === "proposed" && entry.weight === 0.55,
  )
)
  throw new Error(
    "Proposed evidence did not retain the 0.55 exploration weight.",
  );
if (
  !bundle.opportunities.some(
    (entry) =>
      entry.itemId === "unworn" && entry.title === "高偏好、待开发单品",
  )
)
  throw new Error(
    "High-rated item without Best Match support was not surfaced as an opportunity.",
  );
if (!bundle.relations.every((claim) => claim.sourceMatchId === "match-1"))
  throw new Error("Derived relations lost their Best Match source.");
if (
  !bundle.insights.every((insight) =>
    insight.evidenceIds.every((id) =>
      bundle.evidence.some((entry) => entry.id === id),
    ),
  )
)
  throw new Error("An insight contains untraceable evidence.");

console.log(
  `Aesthetic analysis validation passed: ${bundle.evidence.length} evidence entries, ${bundle.insights.length} insights.`,
);
