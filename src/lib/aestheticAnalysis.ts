import type {
  LocalAnalysis,
  LocalColor,
  LocalItem,
  LocalMatch,
  LocalSnapshot,
  LocalTag,
} from "./localAestheticLab";

export const AESTHETIC_ENGINE_VERSION = "aesthetic-understanding-v1";
const ANALYSIS_STORAGE_KEY = "wearlog.local.aesthetic.analysis.v1";
const PROPOSED_WEIGHT = 0.55;

export type BodyProfile = {
  description: string;
  shoulder: "未填写" | "偏窄" | "均衡" | "偏宽";
  torso: "未填写" | "偏短" | "均衡" | "偏长";
  legs: "未填写" | "偏短" | "均衡" | "偏长";
  goals: string[];
  avoidEffects: string[];
};

export const defaultBodyProfile = (): BodyProfile => ({
  description: "",
  shoulder: "未填写",
  torso: "未填写",
  legs: "未填写",
  goals: [],
  avoidEffects: [],
});

export function normalizeBodyProfile(value: unknown): BodyProfile {
  const source =
    value && typeof value === "object" ? (value as Partial<BodyProfile>) : {};
  const legacy = [
    ...(Array.isArray(source.goals)
      ? source.goals.map((entry) => `希望强化：${entry}`)
      : []),
    ...(Array.isArray(source.avoidEffects)
      ? source.avoidEffects.map((entry) => `希望避免：${entry}`)
      : []),
  ];
  return {
    ...defaultBodyProfile(),
    ...source,
    description: toText(source.description) || legacy.join("；"),
  };
}

export type EvidenceLevel = "fact" | "pattern" | "principle" | "hypothesis";
export type ItemRole =
  | "anchor"
  | "stabilizer"
  | "bridge"
  | "accent"
  | "specialist"
  | "emotional_anchor"
  | "unresolved";
export type RelationKind =
  "co_worn_in_match" | "slot_variant_of" | "color_echo" | "style_bridge";

export type AestheticEvidence = {
  id: string;
  kind:
    | "vision"
    | "rating"
    | "item_story"
    | "match_story"
    | "match_structure"
    | "body_profile";
  itemId?: string;
  matchId?: string;
  field?: string;
  quote?: string;
  label: string;
  weight: number;
  status: "confirmed" | "proposed" | "direct";
};

export type RelationClaim = {
  id: string;
  kind: RelationKind;
  leftItemId: string;
  rightItemId: string;
  sourceMatchId: string;
  sourceSlot?: string;
  weight: number;
  level: EvidenceLevel;
  evidenceIds: string[];
};

export type ItemProfile = {
  itemId: string;
  itemName: string;
  rating: number | null;
  primaryMatchCount: number;
  variantMatchCount: number;
  scenes: string[];
  visualSignatureScore: number;
  roles: ItemRole[];
  roleScore: number;
  tagLabels: string[];
  evidenceIds: string[];
};

export type OutfitCompositionProfile = {
  matchId: string;
  name: string;
  scenes: string[];
  primaryItemIds: string[];
  variantItemIds: string[];
  expression: number;
  complexity: number;
  reliability: number;
  silhouetteLabels: string[];
  styleLabels: string[];
  designHighlights: string[];
  colorHexes: Array<{ hex: string; role: LocalColor["role"] }>;
  formalityLabels: string[];
  intentQuotes: string[];
  evidenceIds: string[];
};

export type DimensionProfile = {
  id:
    | "color"
    | "silhouette"
    | "material_design"
    | "formality_scene"
    | "narrative"
    | "time";
  title: string;
  summary: string;
  confirmedCoverage: number;
  proposedCoverage: number;
  evidenceIds: string[];
};

export type AestheticInsight = {
  id: string;
  level: EvidenceLevel;
  title: string;
  body: string;
  supportCount: number;
  confirmedCount: number;
  proposedCount: number;
  evidenceIds: string[];
  action?: string;
};

export type AestheticOpportunity = {
  id: string;
  title: string;
  body: string;
  level: EvidenceLevel;
  itemId?: string;
  evidenceIds: string[];
};

export type AestheticAnalysisBundle = {
  schemaVersion: "wearlog-aesthetic-analysis-v1";
  engineVersion: typeof AESTHETIC_ENGINE_VERSION;
  inputSnapshotHash: string;
  generatedAt: string;
  bodyProfile: BodyProfile;
  coverage: {
    confirmed: number;
    proposed: number;
    totalVision: number;
    bestMatches: number;
  };
  evidence: AestheticEvidence[];
  itemProfiles: ItemProfile[];
  outfits: OutfitCompositionProfile[];
  relations: RelationClaim[];
  dimensions: DimensionProfile[];
  insights: AestheticInsight[];
  opportunities: AestheticOpportunity[];
};

type NarrativeSignal = {
  label: string;
  quote: string;
  kind: AestheticEvidence["kind"];
  itemId?: string;
  matchId?: string;
};

const toText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const list = (value: unknown) => (Array.isArray(value) ? value : []);
const unique = <T>(values: T[]) => [...new Set(values)];
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function stableHash(value: unknown) {
  const source = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `aesthetic-${(hash >>> 0).toString(16)}`;
}

export function snapshotHash(snapshot: LocalSnapshot) {
  return stableHash({
    wardrobeItems: snapshot.wardrobeItems,
    bestMatches: snapshot.bestMatches,
    visionAnalyses: snapshot.visionAnalyses,
  });
}

export function loadAestheticAnalysisBundle(): AestheticAnalysisBundle | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(
      window.localStorage.getItem(ANALYSIS_STORAGE_KEY) || "null",
    );
    return value && value.schemaVersion === "wearlog-aesthetic-analysis-v1"
      ? (value as AestheticAnalysisBundle)
      : null;
  } catch {
    return null;
  }
}

export function saveAestheticAnalysisBundle(bundle: AestheticAnalysisBundle) {
  if (typeof window !== "undefined")
    window.localStorage.setItem(ANALYSIS_STORAGE_KEY, JSON.stringify(bundle));
}

function ratingOf(item: LocalItem) {
  const rating = Number(item.rating);
  return Number.isFinite(rating) ? clamp(rating, 0, 10) : null;
}

function analysisWeight(analysis?: LocalAnalysis) {
  return analysis?.status === "confirmed"
    ? 1
    : analysis?.status === "proposed"
      ? PROPOSED_WEIGHT
      : 0;
}

function statusOf(analysis?: LocalAnalysis): AestheticEvidence["status"] {
  return analysis?.status === "confirmed"
    ? "confirmed"
    : analysis?.status === "proposed"
      ? "proposed"
      : "direct";
}

function slotsOf(match: LocalMatch) {
  const slots: Array<{ slot: string; primary: string; variants: string[] }> =
    [];
  Object.entries(match.items || {}).forEach(([slot, values]) =>
    list(values).forEach((value) => {
      if (typeof value === "string")
        slots.push({ slot, primary: value, variants: [] });
      else if (value && typeof value === "object") {
        const entry = value as { primary?: unknown; variants?: unknown };
        const primary = toText(entry.primary);
        if (primary)
          slots.push({
            slot,
            primary,
            variants: list(entry.variants).map(String).filter(Boolean),
          });
      }
    }),
  );
  return slots;
}

function tagsOf(
  analysis?: LocalAnalysis,
): Array<{ field: string; tag: LocalTag }> {
  if (
    !analysis ||
    analysis.status === "rejected" ||
    analysis.status === "failed"
  )
    return [];
  const payload = analysis.payload;
  const fields: Array<[string, LocalTag[]]> = [
    ["silhouetteTags", payload.silhouetteTags],
    ["materialTags", payload.materialTags],
    ["patternTags", payload.patternTags],
    ["styleTags", payload.styleTags],
    ["designHighlights", payload.designHighlights],
  ];
  return fields.flatMap(([field, tags]) => tags.map((tag) => ({ field, tag })));
}

function sentences(text: string) {
  return text
    .split(/[。！？\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function narrativeSignals(
  text: string,
  kind: AestheticEvidence["kind"],
  itemId?: string,
  matchId?: string,
): NarrativeSignal[] {
  const lexicon: Array<[string, RegExp]> = [
    ["审美偏爱", /喜欢|偏爱|帅|好看|顶|完美|GOAT|对味|美丽/],
    ["功能与舒适", /舒服|好穿|脚感|保暖|防水|实用|功能|轻|重|硬|软/],
    [
      "限制与矛盾",
      /难驾驭|不常穿|吃灰|不适合|太重|掉色|缩水|容易坏|不跟脚|不方便|太短/,
    ],
    [
      "记忆与身份",
      /旅行|朋友|礼物|演唱会|高中|东京|罗马|重庆|美国|启蒙|身份|故事|纪念/,
    ],
    [
      "搭配意图",
      /平衡|呼应|提亮|收束|连接|压低|对比|统一|层次|比例|搭配|替换|换成/,
    ],
  ];
  return sentences(text).flatMap((quote) =>
    lexicon
      .filter(([, pattern]) => pattern.test(quote))
      .map(([label]) => ({ label, quote, kind, itemId, matchId })),
  );
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function colorDistance(left: LocalColor, right: LocalColor) {
  return Math.sqrt(
    left.rgb.reduce(
      (sum, channel, index) => sum + Math.pow(channel - right.rgb[index], 2),
      0,
    ),
  );
}

function levelFor(
  supportCount: number,
  confirmedCount: number,
  proposedCount: number,
): EvidenceLevel {
  if (supportCount >= 3 && confirmedCount >= 1) return "principle";
  if (supportCount >= 2 && confirmedCount >= 1) return "pattern";
  if (confirmedCount >= 1 && proposedCount === 0) return "fact";
  return "hypothesis";
}

function coverage(analyses: LocalAnalysis[]) {
  const confirmed = analyses.filter(
    (analysis) => analysis.status === "confirmed",
  ).length;
  const proposed = analyses.filter(
    (analysis) => analysis.status === "proposed",
  ).length;
  return { confirmed, proposed, totalVision: confirmed + proposed };
}

export function buildAestheticAnalysis(
  snapshot: LocalSnapshot,
  bodyProfile: BodyProfile,
): AestheticAnalysisBundle {
  const inputSnapshotHash = snapshotHash(snapshot);
  const itemById = new Map(
    snapshot.wardrobeItems.map((item) => [item.id, item]),
  );
  const analysisByItem = new Map(
    snapshot.visionAnalyses.map((analysis) => [analysis.itemId, analysis]),
  );
  const evidence: AestheticEvidence[] = [];
  const addEvidence = (entry: Omit<AestheticEvidence, "id">) => {
    const id = `ev-${evidence.length + 1}`;
    evidence.push({ id, ...entry });
    return id;
  };

  const itemEvidence = new Map<string, string[]>();
  const attachItemEvidence = (itemId: string, id: string) =>
    itemEvidence.set(itemId, [...(itemEvidence.get(itemId) || []), id]);
  snapshot.wardrobeItems.forEach((item) => {
    const rating = ratingOf(item);
    if (rating !== null)
      attachItemEvidence(
        item.id,
        addEvidence({
          kind: "rating",
          itemId: item.id,
          label: `综合偏好评分 ${rating}/10`,
          weight: 1,
          status: "direct",
        }),
      );
    const analysis = analysisByItem.get(item.id);
    tagsOf(analysis).forEach(({ field, tag }) =>
      attachItemEvidence(
        item.id,
        addEvidence({
          kind: "vision",
          itemId: item.id,
          field,
          label: tag.value,
          quote: tag.evidence || undefined,
          weight: analysisWeight(analysis),
          status: statusOf(analysis),
        }),
      ),
    );
    (analysis?.payload.dominantColors || []).forEach((color) =>
      attachItemEvidence(
        item.id,
        addEvidence({
          kind: "vision",
          itemId: item.id,
          field: "dominantColors",
          label: `${color.role} ${color.hex}`,
          weight: analysisWeight(analysis),
          status: statusOf(analysis),
        }),
      ),
    );
    narrativeSignals(toText(item.story), "item_story", item.id).forEach(
      (signal) =>
        attachItemEvidence(
          item.id,
          addEvidence({
            kind: signal.kind,
            itemId: item.id,
            label: signal.label,
            quote: signal.quote,
            weight: 0.9,
            status: "direct",
          }),
        ),
    );
  });
  const bodyDescription = toText(bodyProfile.description);
  if (bodyProfile.goals.length || bodyProfile.avoidEffects.length)
    addEvidence({
      kind: "body_profile",
      label: "Victor 主动填写的身形目标",
      quote: [
        ...bodyProfile.goals.map((goal) => `强化：${goal}`),
        ...bodyProfile.avoidEffects.map((effect) => `避免：${effect}`),
      ].join("；"),
      weight: 1,
      status: "direct",
    });

  if (bodyDescription)
    addEvidence({
      kind: "body_profile",
      label: "Victor 的身形与穿衣感受原话",
      quote: bodyDescription,
      weight: 1,
      status: "direct",
    });

  const matchEvidence = new Map<string, string[]>();
  const attachMatchEvidence = (matchId: string, id: string) =>
    matchEvidence.set(matchId, [...(matchEvidence.get(matchId) || []), id]);
  snapshot.bestMatches.forEach((match) => {
    attachMatchEvidence(
      match.id,
      addEvidence({
        kind: "match_structure",
        matchId: match.id,
        label: `Best Match 槽位结构`,
        weight: 1,
        status: "direct",
      }),
    );
    narrativeSignals(
      toText(match.story),
      "match_story",
      undefined,
      match.id,
    ).forEach((signal) =>
      attachMatchEvidence(
        match.id,
        addEvidence({
          kind: signal.kind,
          matchId: match.id,
          label: signal.label,
          quote: signal.quote,
          weight: 0.9,
          status: "direct",
        }),
      ),
    );
  });

  const profiles = snapshot.wardrobeItems.map((item) => {
    const analysis = analysisByItem.get(item.id);
    const occurrences = snapshot.bestMatches
      .flatMap((match) => slotsOf(match).map((slot) => ({ match, slot })))
      .filter(
        ({ slot }) =>
          slot.primary === item.id || slot.variants.includes(item.id),
      );
    const primaryMatchCount = new Set(
      occurrences
        .filter(({ slot }) => slot.primary === item.id)
        .map(({ match }) => match.id),
    ).size;
    const variantMatchCount = new Set(
      occurrences
        .filter(({ slot }) => slot.variants.includes(item.id))
        .map(({ match }) => match.id),
    ).size;
    const scenes = unique(
      occurrences.flatMap(({ match }) => match.sceneTags || []),
    );
    const tags = tagsOf(analysis);
    const signature =
      tags.filter(
        ({ field }) => field === "designHighlights" || field === "styleTags",
      ).length +
      (analysis?.payload.dominantColors.filter(
        (color) => color.role === "accent",
      ).length || 0);
    const itemSignals = evidence
      .filter(
        (entry) => entry.itemId === item.id && entry.kind === "item_story",
      )
      .map((entry) => entry.label);
    const rating = ratingOf(item);
    const roles: ItemRole[] = [];
    if (
      rating !== null &&
      rating >= 8 &&
      (signature >= 2 || itemSignals.includes("审美偏爱"))
    )
      roles.push("anchor");
    if (rating !== null && rating >= 8 && primaryMatchCount === 0)
      roles.push(
        itemSignals.includes("记忆与身份") ? "emotional_anchor" : "specialist",
      );
    if (primaryMatchCount >= 2 && ((rating ?? 5) <= 7 || signature <= 2))
      roles.push("stabilizer");
    if (variantMatchCount > 0 || scenes.length >= 2) roles.push("bridge");
    if (signature >= 2 && !roles.includes("anchor")) roles.push("accent");
    if (!roles.length) roles.push("unresolved");
    const roleScore = clamp(
      (rating || 0) * 6 +
        primaryMatchCount * 10 +
        variantMatchCount * 7 +
        signature * 7 +
        itemSignals.length * 5,
      0,
      100,
    );
    return {
      itemId: item.id,
      itemName: item.name || item.id,
      rating,
      primaryMatchCount,
      variantMatchCount,
      scenes,
      visualSignatureScore: signature,
      roles,
      roleScore,
      tagLabels: unique(tags.map(({ tag }) => tag.value)),
      evidenceIds: itemEvidence.get(item.id) || [],
    } satisfies ItemProfile;
  });
  const profileByItem = new Map(
    profiles.map((profile) => [profile.itemId, profile]),
  );

  const outfits = snapshot.bestMatches.map((match) => {
    const slots = slotsOf(match);
    const primaryItemIds = unique(slots.map((slot) => slot.primary));
    const variantItemIds = unique(slots.flatMap((slot) => slot.variants));
    const analyses = primaryItemIds
      .map((id) => analysisByItem.get(id))
      .filter((analysis): analysis is LocalAnalysis => !!analysis);
    const primaryTags = analyses.flatMap(tagsOf);
    const highlights = unique(
      primaryTags
        .filter(({ field }) => field === "designHighlights")
        .map(({ tag }) => tag.value),
    );
    const styles = unique(
      primaryTags
        .filter(({ field }) => field === "styleTags")
        .map(({ tag }) => tag.value),
    );
    const silhouettes = unique(
      primaryTags
        .filter(({ field }) => field === "silhouetteTags")
        .map(({ tag }) => tag.value),
    );
    const formalities = unique(
      analyses
        .map((analysis) => analysis.payload.formality?.value)
        .filter(Boolean) as string[],
    );
    const colors = analyses.flatMap((analysis) =>
      analysis.payload.dominantColors.map((color) => ({
        hex: color.hex,
        role: color.role,
      })),
    );
    const expression = clamp(
      styles.length * 13 +
        highlights.length * 16 +
        colors.filter((color) => color.role === "accent").length * 14 +
        primaryItemIds.filter((id) =>
          profileByItem.get(id)?.roles.includes("anchor"),
        ).length *
          10,
      0,
      100,
    );
    const complexity = clamp(
      primaryItemIds.length * 14 +
        slots.length * 9 +
        highlights.length * 9 +
        styles.length * 5,
      0,
      100,
    );
    const reliability = Math.round(average(analyses.map(analysisWeight)) * 100);
    const intentQuotes = evidence
      .filter(
        (entry) =>
          entry.matchId === match.id &&
          entry.kind === "match_story" &&
          entry.label === "搭配意图",
      )
      .map((entry) => entry.quote || "")
      .filter(Boolean);
    return {
      matchId: match.id,
      name: match.name || "未命名 Best Match",
      scenes: match.sceneTags || [],
      primaryItemIds,
      variantItemIds,
      expression,
      complexity,
      reliability,
      silhouetteLabels: silhouettes,
      styleLabels: styles,
      designHighlights: highlights,
      colorHexes: colors,
      formalityLabels: formalities,
      intentQuotes,
      evidenceIds: matchEvidence.get(match.id) || [],
    } satisfies OutfitCompositionProfile;
  });

  const relations: RelationClaim[] = [];
  const addRelation = (claim: Omit<RelationClaim, "id">) =>
    relations.push({ id: `rel-${relations.length + 1}`, ...claim });
  snapshot.bestMatches.forEach((match) => {
    const slots = slotsOf(match);
    const primaryIds = unique(slots.map((slot) => slot.primary));
    primaryIds.forEach((left, index) =>
      primaryIds.slice(index + 1).forEach((right) => {
        const pairAnalyses = [
          analysisByItem.get(left),
          analysisByItem.get(right),
        ].filter((analysis): analysis is LocalAnalysis => !!analysis);
        const confirmedCount = pairAnalyses.filter(
          (analysis) => analysis.status === "confirmed",
        ).length;
        const proposedCount = pairAnalyses.filter(
          (analysis) => analysis.status === "proposed",
        ).length;
        addRelation({
          kind: "co_worn_in_match",
          leftItemId: left,
          rightItemId: right,
          sourceMatchId: match.id,
          weight: average(pairAnalyses.map(analysisWeight)) || 1,
          level: levelFor(1, confirmedCount, proposedCount),
          evidenceIds: matchEvidence.get(match.id) || [],
        });
        const leftColors =
          analysisByItem.get(left)?.payload.dominantColors || [];
        const rightColors =
          analysisByItem.get(right)?.payload.dominantColors || [];
        if (
          leftColors.some((leftColor) =>
            rightColors.some(
              (rightColor) => colorDistance(leftColor, rightColor) < 95,
            ),
          )
        )
          addRelation({
            kind: "color_echo",
            leftItemId: left,
            rightItemId: right,
            sourceMatchId: match.id,
            weight:
              average(pairAnalyses.map(analysisWeight)) || PROPOSED_WEIGHT,
            level: levelFor(1, confirmedCount, proposedCount),
            evidenceIds: [
              ...(itemEvidence.get(left) || []),
              ...(itemEvidence.get(right) || []),
              ...(matchEvidence.get(match.id) || []),
            ],
          });
      }),
    );
    slots.forEach((slot) =>
      slot.variants.forEach((variant) =>
        addRelation({
          kind: "slot_variant_of",
          leftItemId: slot.primary,
          rightItemId: variant,
          sourceMatchId: match.id,
          sourceSlot: slot.slot,
          weight: 1,
          level: "fact",
          evidenceIds: matchEvidence.get(match.id) || [],
        }),
      ),
    );
  });
  profiles
    .filter((profile) => profile.roles.includes("bridge"))
    .forEach((profile) => {
      const neighbours = relations
        .filter(
          (relation) =>
            relation.leftItemId === profile.itemId ||
            relation.rightItemId === profile.itemId,
        )
        .slice(0, 2);
      neighbours.forEach((relation) =>
        addRelation({
          kind: "style_bridge",
          leftItemId: relation.leftItemId,
          rightItemId: relation.rightItemId,
          sourceMatchId: relation.sourceMatchId,
          weight: relation.weight,
          level: relation.level,
          evidenceIds: relation.evidenceIds,
        }),
      );
    });

  const visionCoverage = coverage(snapshot.visionAnalyses);
  const percentage = (value: number) =>
    visionCoverage.totalVision
      ? Math.round((value / visionCoverage.totalVision) * 100)
      : 0;
  const top = <T>(values: T[], getter: (value: T) => string[]) => {
    const counts = new Map<string, number>();
    values.forEach((value) =>
      getter(value).forEach((entry) =>
        counts.set(entry, (counts.get(entry) || 0) + 1),
      ),
    );
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([entry]) => entry);
  };
  const dimensions: DimensionProfile[] = [
    {
      id: "color",
      title: "色彩架构",
      summary: (() => {
        const colors = top(outfits, (outfit) =>
          outfit.colorHexes.map((color) => color.hex),
        );
        return colors.length
          ? `搭配中反复出现的颜色不是偏好结论；当前可追溯的色彩线索是 ${colors.join("、")}，需结合评分、颜色角色与场景理解。`
          : "颜色字段覆盖不足，暂不生成色彩原则。";
      })(),
      confirmedCoverage: percentage(visionCoverage.confirmed),
      proposedCoverage: percentage(visionCoverage.proposed),
      evidenceIds: evidence
        .filter(
          (entry) =>
            entry.kind === "vision" && entry.field === "dominantColors",
        )
        .map((entry) => entry.id),
    },
    {
      id: "silhouette",
      title: "廓形与身形",
      summary: bodyDescription
        ? `已记录你的身形与穿衣感受：「${bodyDescription}」。当前系统只展示由廓形与搭配结构支持的待验证候选，不从图片推断身体条件。`
        : bodyProfile.goals.length
          ? `已记录修饰目标：${bodyProfile.goals.join("、")}。当前系统仅展示由廓形与搭配结构支持的待验证候选，不从图片推断身体条件。`
          : "尚未填写身形目标；系统不会对身形修饰作出断言。",
      confirmedCoverage: percentage(visionCoverage.confirmed),
      proposedCoverage: percentage(visionCoverage.proposed),
      evidenceIds: evidence
        .filter(
          (entry) =>
            entry.kind === "vision" && entry.field === "silhouetteTags",
        )
        .map((entry) => entry.id),
    },
    {
      id: "material_design",
      title: "材质与设计",
      summary: (() => {
        const labels = top(outfits, (outfit) => outfit.designHighlights);
        return labels.length
          ? `可见的设计焦点集中在 ${labels.join("、")}；它们应与具体搭配中的稳定器一起阅读。`
          : "设计亮点的 confirmed 覆盖仍不足，暂只保留待验证信号。";
      })(),
      confirmedCoverage: percentage(visionCoverage.confirmed),
      proposedCoverage: percentage(visionCoverage.proposed),
      evidenceIds: evidence
        .filter(
          (entry) =>
            entry.kind === "vision" &&
            (entry.field === "materialTags" ||
              entry.field === "designHighlights"),
        )
        .map((entry) => entry.id),
    },
    {
      id: "formality_scene",
      title: "正式度与场景",
      summary: (() => {
        const scenes = top(outfits, (outfit) => outfit.scenes);
        const formalities = top(outfits, (outfit) => outfit.formalityLabels);
        return scenes.length || formalities.length
          ? `当前 Best Match 在 ${scenes.join("、") || "未标注场景"} 中展开，正式度线索为 ${formalities.join("、") || "待补充"}。`
          : "场景或正式度字段不足。";
      })(),
      confirmedCoverage: percentage(visionCoverage.confirmed),
      proposedCoverage: percentage(visionCoverage.proposed),
      evidenceIds: evidence
        .filter(
          (entry) =>
            entry.kind === "match_structure" ||
            (entry.kind === "vision" && entry.field === "formality"),
        )
        .map((entry) => entry.id),
    },
    {
      id: "narrative",
      title: "情感与身份",
      summary: (() => {
        const entries = evidence.filter(
          (entry) =>
            entry.kind === "item_story" && entry.label === "记忆与身份",
        );
        return entries.length
          ? `已有 ${entries.length} 条带原文的记忆/身份线索；它们不会被词频替代，而会与具体单品和评分绑定。`
          : "尚未从故事中发现可直接引用的身份/记忆线索。";
      })(),
      confirmedCoverage: 100,
      proposedCoverage: 0,
      evidenceIds: evidence
        .filter((entry) => entry.kind === "item_story")
        .map((entry) => entry.id),
    },
    {
      id: "time",
      title: "时间变化",
      summary: (() => {
        const years = top(snapshot.wardrobeItems, (item) => [
          toText(item.purchaseYear),
        ]);
        return years.length
          ? `购买年份记录覆盖 ${years.join("、")}；当前用于观察审美演变，不把年份本身解释为风格因果。`
          : "购买年份不足，无法形成时间变化观察。";
      })(),
      confirmedCoverage: 100,
      proposedCoverage: 0,
      evidenceIds: evidence
        .filter(
          (entry) => entry.kind === "rating" || entry.kind === "item_story",
        )
        .map((entry) => entry.id),
    },
  ];

  const insights: AestheticInsight[] = [];
  const addInsight = (entry: Omit<AestheticInsight, "id">) =>
    insights.push({ id: `ins-${insights.length + 1}`, ...entry });
  const anchors = profiles
    .filter((profile) => profile.roles.includes("anchor"))
    .sort((left, right) => right.roleScore - left.roleScore);
  const stabilizers = profiles
    .filter((profile) => profile.roles.includes("stabilizer"))
    .sort((left, right) => right.roleScore - left.roleScore);
  if (anchors[0]) {
    const support = anchors[0].primaryMatchCount + anchors[0].variantMatchCount;
    const confirmedCount = anchors[0].evidenceIds.filter(
      (id) => evidence.find((entry) => entry.id === id)?.status === "confirmed",
    ).length;
    addInsight({
      level: levelFor(Math.max(1, support), confirmedCount, 0),
      title: "表达锚点正在形成",
      body: `「${anchors[0].itemName}」同时具备综合偏好、视觉签名或叙事证据，是当前最有根据的表达锚点候选；它不是因为出现次数多，而是因为证据类型更完整。`,
      supportCount: support,
      confirmedCount,
      proposedCount: 0,
      evidenceIds: anchors[0].evidenceIds,
      action: "查看它在哪些 Best Match 中承担表达焦点。",
    });
  }
  if (anchors[0] && stabilizers[0]) {
    const pairRelations = relations.filter(
      (relation) =>
        [relation.leftItemId, relation.rightItemId].includes(
          anchors[0].itemId,
        ) &&
        [relation.leftItemId, relation.rightItemId].includes(
          stabilizers[0].itemId,
        ),
    );
    if (pairRelations.length) {
      const confirmedCount = pairRelations.filter(
        (relation) => relation.level !== "hypothesis",
      ).length;
      addInsight({
        level: levelFor(pairRelations.length, confirmedCount, 0),
        title: "表达与收束的搭配语法",
        body: `现有 Best Match 显示，「${anchors[0].itemName}」的表达性会由「${stabilizers[0].itemName}」这类稳定器承接；这是一条搭配结构模式，而不是“谁出现得更多”。`,
        supportCount: pairRelations.length,
        confirmedCount,
        proposedCount: 0,
        evidenceIds: unique(
          pairRelations.flatMap((relation) => relation.evidenceIds),
        ),
        action: "打开对应 Best Match，校验收束是否来自颜色、廓形或正式度。",
      });
    }
  }
  const stylePairs = new Map<
    string,
    {
      count: number;
      confirmed: number;
      proposed: number;
      evidenceIds: string[];
    }
  >();
  outfits.forEach((outfit) =>
    unique([
      ...outfit.styleLabels,
      ...outfit.silhouetteLabels,
      ...outfit.designHighlights,
    ])
      .slice(0, 8)
      .forEach((left, index, values) =>
        values.slice(index + 1).forEach((right) => {
          const key = [left, right].sort().join(" × ");
          const current = stylePairs.get(key) || {
            count: 0,
            confirmed: 0,
            proposed: 0,
            evidenceIds: [],
          };
          current.count += 1;
          if (outfit.reliability >= 100) current.confirmed += 1;
          else current.proposed += 1;
          current.evidenceIds.push(...outfit.evidenceIds);
          stylePairs.set(key, current);
        }),
      ),
  );
  const recurringPair = [...stylePairs.entries()].sort(
    (left, right) => right[1].count - left[1].count,
  )[0];
  if (recurringPair)
    addInsight({
      level: levelFor(
        recurringPair[1].count,
        recurringPair[1].confirmed,
        recurringPair[1].proposed,
      ),
      title: "重复出现的视觉组合",
      body: `「${recurringPair[0]}」在 ${recurringPair[1].count} 套 Best Match 的搭配组成中共同出现。它是可审计的视觉组合线索，需继续由场景、评分和原文解释其意义。`,
      supportCount: recurringPair[1].count,
      confirmedCount: recurringPair[1].confirmed,
      proposedCount: recurringPair[1].proposed,
      evidenceIds: unique(recurringPair[1].evidenceIds),
    });
  const narrativeItems = profiles
    .filter((profile) =>
      profile.evidenceIds.some(
        (id) =>
          evidence.find((entry) => entry.id === id)?.label === "记忆与身份",
      ),
    )
    .sort((left, right) => right.roleScore - left.roleScore);
  if (narrativeItems[0])
    addInsight({
      level: "fact",
      title: "衣橱中存在不应被频率淹没的情感锚点",
      body: `「${narrativeItems[0].itemName}」具有可引用的记忆或身份叙事。即使它不高频出现，也应作为个人审美档案的一部分，而非被简单归为低复用单品。`,
      supportCount: 1,
      confirmedCount: 1,
      proposedCount: 0,
      evidenceIds: narrativeItems[0].evidenceIds,
    });
  if (bodyDescription.length)
    addInsight({
      level: "hypothesis",
      title: "身形修饰已有明确目标，但仍需效果校验",
      body: `你的原话是：「${bodyDescription}」。系统会把廓形和层级当作候选解释，但不会在没有 Victor 校验的情况下宣称某件衣服“修饰了身形”。`,
      supportCount: 0,
      confirmedCount: 0,
      proposedCount: 0,
      evidenceIds: evidence
        .filter((entry) => entry.kind === "body_profile")
        .map((entry) => entry.id),
      action: "在未来的 Best Match 校验中记录“支持 / 冲突 / 无感”的真实效果。",
    });

  const opportunities: AestheticOpportunity[] = [];
  profiles
    .filter(
      (profile) =>
        (profile.rating || 0) >= 8 && profile.primaryMatchCount === 0,
    )
    .forEach((profile) =>
      opportunities.push({
        id: `opp-${opportunities.length + 1}`,
        title: "高偏好、待开发单品",
        body: `「${profile.itemName}」评分为 ${profile.rating}/10，但还没有作为 Best Match 主单品出现。它值得进入实验台，而不是被词频系统忽略。`,
        level: "fact",
        itemId: profile.itemId,
        evidenceIds: profile.evidenceIds,
      }),
    );
  profiles
    .filter(
      (profile) =>
        profile.roles.includes("stabilizer") && (profile.rating || 0) <= 6,
    )
    .forEach((profile) =>
      opportunities.push({
        id: `opp-${opportunities.length + 1}`,
        title: "功能稳定器与审美偏好的张力",
        body: `「${profile.itemName}」承担稳定器角色，但评分为 ${profile.rating}/10。它可能是可穿性工具，不应被解读为 Victor 的审美核心。`,
        level: "pattern",
        itemId: profile.itemId,
        evidenceIds: profile.evidenceIds,
      }),
    );
  if (visionCoverage.proposed)
    opportunities.push({
      id: `opp-${opportunities.length + 1}`,
      title: "待确认视觉字段正在扩展探索范围",
      body: `当前有 ${visionCoverage.proposed} 条 proposed 读图记录以 0.55 权重参与探索。确认它们会提高搭配语法与角色判断的可靠度，但不会覆盖现有 confirmed。`,
      level: "hypothesis",
      evidenceIds: evidence
        .filter((entry) => entry.status === "proposed")
        .map((entry) => entry.id),
    });

  return {
    schemaVersion: "wearlog-aesthetic-analysis-v1",
    engineVersion: AESTHETIC_ENGINE_VERSION,
    inputSnapshotHash,
    generatedAt: new Date().toISOString(),
    bodyProfile,
    coverage: { ...visionCoverage, bestMatches: snapshot.bestMatches.length },
    evidence,
    itemProfiles: profiles.sort(
      (left, right) => right.roleScore - left.roleScore,
    ),
    outfits,
    relations,
    dimensions,
    insights: insights.slice(0, 5),
    opportunities: opportunities.slice(0, 8),
  };
}
