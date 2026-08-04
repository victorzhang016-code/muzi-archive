import type {
  LocalAnalysis,
  LocalColor,
  LocalItem,
  LocalMatch,
  LocalSlot,
  LocalSnapshot,
  LocalTag,
} from "./aestheticContracts";

export const AESTHETIC_ENGINE_VERSION = "wearlog-aesthetic-v3.5.0";
export const AESTHETIC_V4_ENGINE_VERSION = "wearlog-aesthetic-v4.0.0";
export const AESTHETIC_SCHEMA_VERSION = "wearlog-aesthetic-knowledge-v3";
export const TEXT_PROMPT_VERSION = "wearlog-explicit-intent-v1";
export const DECISION_BRIEF_PROMPT_VERSION = "wearlog-decision-brief-v1";
export const KIMI_DECISION_BRIEF_TIMEOUT_MS = 60_000;
export const CONCEPT_GRAPH_VERSION = "wearlog-concepts-zh-v1";

export type VisionField =
  | "silhouette"
  | "material"
  | "pattern"
  | "style"
  | "design_highlight"
  | "visual_weight"
  | "formality";
export type EvidenceStatus = "confirmed" | "proposed" | "direct_text" | "derived";
export type PrincipleKind = "self_aware" | "enacted" | "emerging" | "frontier" | "case_only";
export type CalibrationTier = "representative" | "mature" | "usable";
export type SlotKind = "tops" | "bottoms" | "shoes" | "accessories" | string;

export type SourceSnapshotManifest = {
  sourceFile?: string;
  sourceSha256: string;
  generatedAt: string;
  schemaVersion: string;
  counts: {
    items: number;
    analyses: number;
    confirmedAnalyses: number;
    matches: number;
    validVariantEdges: number;
    uniqueSubstitutionPairs: number;
    repeatedSubstitutionPairs: number;
  };
  issues: DataQualityIssue[];
};

export type DataQualityIssue = {
  code: "empty_variant" | "missing_year" | "missing_reference" | "duplicate_reference" | "unconfirmed_vision";
  count: number;
  sourceIds: string[];
  message: string;
};

export type SemanticAtom = {
  id: string;
  itemId: string;
  field: VisionField;
  value: string;
  normalized: string;
  parentValue: string;
  parentIndex: number;
  atomIndex: number;
  source: LocalTag["source"] | "user_color";
  evidenceStatus: "confirmed" | "proposed";
  weight: number;
};

export type PerceptualColor = {
  itemId: string;
  rgb: [number, number, number];
  hex: string;
  role: LocalColor["role"];
  areaRatio: number;
  lab: [number, number, number];
  oklch: [number, number, number];
  source: LocalColor["source"];
};

export type ConceptRelation = {
  from: string;
  to: string;
  kind: "synonym" | "broader" | "related" | "tension";
  version: string;
};

export type TextClaimType =
  | "preference"
  | "aversion"
  | "design_appreciation"
  | "emotion_identity"
  | "function_comfort"
  | "body_constraint"
  | "scene"
  | "core_item"
  | "color_operation"
  | "proportion_operation"
  | "material_operation"
  | "formality_operation"
  | "substitution_reason"
  | "constraint";

export type TextClaim = {
  id: string;
  sourceType: "item" | "best_match" | "manual";
  sourceId: string;
  sourceHash: string;
  quote: string;
  type: TextClaimType;
  subjectItemIds: string[];
  operation?: string;
  effect?: string;
  condition?: string;
  limitation?: string;
  confidence: number;
  status: "candidate" | "confirmed" | "rejected";
  extractor: "deterministic" | "kimi" | "user";
  modelVersion: string;
  promptVersion: string;
};

export type OutfitCalibration = {
  matchId: string;
  anchorItemId: string;
  tier: CalibrationTier;
  note?: string;
  confirmedByUser: boolean;
};

export type OutfitDecisionBrief = {
  matchId: string;
  focus: string;
  problem: string;
  outcome: string;
  source?: "kimi" | "user";
  confirmation?: "manual" | "user_authorized_auto";
  modelVersion?: string;
  promptVersion?: string;
  confirmed: boolean;
  updatedAt: string;
};

export type KimiDecisionBriefItem = {
  itemId: string;
  itemName: string;
  slot: SlotKind;
  confirmedFields: Array<{ field: VisionField; values: string[] }>;
  colors: Array<{ role: LocalColor["role"]; hex: string; family: ColorFamily }>;
};

export type KimiDecisionBriefRequest = {
  matchId: string;
  outfitName: string;
  story: string;
  anchor: KimiDecisionBriefItem;
  items: KimiDecisionBriefItem[];
  confirmedTextEvidence: Array<{ quote: string; type: TextClaimType; operation?: string; effect?: string }>;
  decisionMechanisms: Array<{ operation: string; role: DecisionMechanism["role"]; condition: string; action: string; effect: string }>;
};

export function authorizeKimiDecisionBrief(brief: OutfitDecisionBrief): OutfitDecisionBrief {
  return {
    ...brief,
    source: "kimi",
    confirmation: "user_authorized_auto",
    confirmed: true,
    updatedAt: new Date().toISOString(),
  };
}

export function planKimiDecisionBriefAutomation(run: Pick<AnalysisRun, "outfitCases">, briefs: OutfitDecisionBrief[]) {
  const byMatch = new Map(briefs.map((brief) => [brief.matchId, brief]));
  return {
    generateMatchIds: run.outfitCases.filter((outfit) => !byMatch.has(outfit.matchId)).map((outfit) => outfit.matchId),
    autoConfirmMatchIds: run.outfitCases
      .filter((outfit) => byMatch.get(outfit.matchId)?.source === "kimi" && !byMatch.get(outfit.matchId)?.confirmed)
      .map((outfit) => outfit.matchId),
  };
}

export type WearOutcome = {
  id: string;
  opportunityId: string;
  state: "accepted" | "worn" | "satisfied" | "unsatisfied" | "not_worn";
  reason?: string;
  updatedAt: string;
};

export type OutfitRelation = {
  id: string;
  matchId: string;
  anchorItemId: string;
  supportItemId: string;
  slot: SlotKind;
  operation:
    | "anchor_support"
    | "color_echo"
    | "color_lighten"
    | "color_ground"
    | "volume_balance"
    | "line_continue"
    | "material_harmony"
    | "material_tension"
    | "formality_adjust"
    | "focus_control"
    | "identity_expression";
  effect: string;
  evidenceIds: string[];
  confidence: number;
};

export type DecisionMechanism = {
  id: string;
  ruleId: string;
  caseId: string;
  operation: Exclude<OutfitRelation["operation"], "anchor_support">;
  condition: string;
  action: string;
  effect: string;
  role: "dominant" | "supporting" | "structural";
  supportItemIds: string[];
  slots: SlotKind[];
  evidenceIds: string[];
  sourceRelationIds: string[];
  confidence: number;
  status: "fact" | "confirmed_intent" | "derived" | "pending";
};

export type RuleValidation = {
  scope: "affected_slots" | "not_applicable";
  slots: string[];
  cases: number;
  engineTop3: number;
  baselineTop3: number;
  passed: boolean;
  note: string;
};

export type OutfitCaseGraph = {
  matchId: string;
  name: string;
  story: string;
  anchorItemId: string;
  anchorItemName: string;
  tier: CalibrationTier;
  primaryItems: Array<{ itemId: string; itemName: string; slot: SlotKind }>;
  variantItems: Array<{ itemId: string; itemName: string; slot: SlotKind; replacesItemId: string }>;
  relations: OutfitRelation[];
  decisionMechanisms: DecisionMechanism[];
  mechanismKeys: string[];
  explicitClaimIds: string[];
  evidenceCoverage: number;
  composition: OutfitCompositionProfile;
  decisionBrief?: OutfitDecisionBrief;
};

export type OutfitCompositionProfile = {
  topWidth: "wide" | "clean" | "unknown";
  topLength: "long" | "short" | "regular" | "unknown";
  bottomWidth: "wide" | "clean" | "unknown";
  bottomLength: "long" | "short" | "regular" | "unknown";
  ankleFinish: "closed" | "open" | "unknown";
  shoeWeight: "heavy" | "light" | "unknown";
  colorRoles: { dominant: number; secondary: number; accent: number };
  colorPalette: Array<{ itemId: string; role: LocalColor["role"]; family: ColorFamily; hex: string }>;
  designFocus: {
    distribution: "core_led" | "shared" | "support_led" | "quiet";
    focusItemIds: string[];
    supportDetailItemIds: string[];
    focusHighlights: string[];
  };
  focusItemId?: string;
};

export type ColorFamily = "黑" | "白" | "灰" | "棕" | "米" | "红" | "橙" | "黄" | "绿" | "青" | "蓝" | "紫" | "粉" | "未知";

export type DesignHighlightInsight = {
  id: string;
  title: string;
  statement: string;
  level: "premise" | "stable" | "emerging" | "case";
  itemIds: string[];
  matchIds: string[];
  evidenceIds: string[];
  confirmedCoverage: number;
};

export type ColorInsight = {
  id: string;
  kind: "wardrobe_preference" | "outfit_pairing" | "item_palette";
  title: string;
  statement: string;
  level: "stable" | "emerging" | "case";
  itemIds: string[];
  matchIds: string[];
  evidenceIds: string[];
  confirmedCoverage: number;
};

export type SubstitutionContract = {
  id: string;
  fromItemId: string;
  fromItemName: string;
  toItemId: string;
  toItemName: string;
  slot: SlotKind;
  contextMatchIds: string[];
  contextAnchorIds: string[];
  invariants: string[];
  allowedChanges: string[];
  effectChanges: string[];
  boundary: string;
  repeated: boolean;
  evidenceIds: string[];
};

export type EvidenceRecord = {
  id: string;
  kind: "field" | "color" | "rating" | "story_quote" | "match_slot" | "variant" | "calibration" | "validation" | "decision_brief" | "wear_outcome";
  sourceId: string;
  label: string;
  quote?: string;
  status: EvidenceStatus;
  weight: number;
  detail?: string;
};

export type AestheticPrinciple = {
  id: string;
  title: string;
  statement: string;
  condition: string;
  mechanism: string;
  effect: string;
  kind: PrincipleKind;
  supportMatchIds: string[];
  representativeMatchIds: string[];
  evidenceIds: string[];
  counterexampleMatchIds: string[];
  unresolvedQuestionIds: string[];
  confirmedCoverage: number;
  holdoutSupport: boolean;
  supportNote: string;
  decisionMechanismIds: string[];
  reconnectedEvidenceIds: string[];
  reconnectionCoverage: number;
  reconnectionStatus: "reconnected" | "pending" | "review";
  ruleValidation: RuleValidation;
};

export type PrincipleBaseline = {
  id: string;
  principle: AestheticPrinciple;
  capturedAt: string;
  sourceEngineVersion: string;
};

export type ReviewQuestion = {
  id: string;
  priority: 1 | 2 | 3 | 4 | 5;
  kind: "text_structure_conflict" | "semantic_ambiguity" | "anchor_unclear" | "body_effect" | "near_substitution";
  question: string;
  context: string;
  whyItMatters: string;
  sourceIds: string[];
  options: [string, string];
  answer?: string;
};

export type PotentialItem = {
  itemId: string;
  itemName: string;
  rating: number | null;
  matchCount: number;
  observedSlots: string[];
  reason: string;
  evidenceIds: string[];
};

export type CombinationOpportunity = {
  id: string;
  anchorItemId: string;
  anchorItemName: string;
  targetSlot: SlotKind;
  replacesItemId: string;
  replacesItemName: string;
  candidateItemId: string;
  candidateItemName: string;
  reasons: string[];
  evidenceIds: string[];
  score: number;
};

export type ManualFeedback = {
  id: string;
  targetType: "potential" | "review" | "opportunity";
  targetId: string;
  choice?: string;
  note?: string;
  updatedAt: string;
};

export type TextExtractionRecord = {
  sourceType: "item" | "best_match";
  sourceId: string;
  text: string;
};

export type TextExtractionScope = "best_match" | "item";

export type SilhouettePairingRule = {
  id: string;
  title: string;
  action: string;
  boundary: string;
  topShape: "relaxed" | "clean" | "mixed";
  bottomShape: "relaxed" | "clean" | "mixed";
  matchIds: string[];
  evidenceIds: string[];
  confirmedCoverage: number;
};

export type HoldoutSlotResult = {
  slot: string;
  cases: number;
  engineTop3: number;
  baselineTop3: number;
  engineRate: number;
  baselineRate: number;
};

export type ValidationReport = {
  slots: HoldoutSlotResult[];
  engineOverallRate: number;
  baselineOverallRate: number;
  beatsBaseline: boolean;
  explanationTraceRate: number;
};

export type AnalysisRun = {
  id: string;
  inputSnapshotHash: string;
  engineVersion: string;
  promptVersion: string;
  conceptGraphVersion: string;
  generatedAt: string;
  bodyProfileText: string;
  manifest: SourceSnapshotManifest;
  atoms: SemanticAtom[];
  colors: PerceptualColor[];
  conceptRelations: ConceptRelation[];
  textClaims: TextClaim[];
  calibrations: OutfitCalibration[];
  decisionBriefs?: OutfitDecisionBrief[];
  wearOutcomes?: WearOutcome[];
  outfitCases: OutfitCaseGraph[];
  substitutions: SubstitutionContract[];
  silhouetteRules: SilhouettePairingRule[];
  designHighlights: DesignHighlightInsight[];
  colorInsights: ColorInsight[];
  principles: AestheticPrinciple[];
  principleBaselines?: PrincipleBaseline[];
  reviewQuestions: ReviewQuestion[];
  potentials: PotentialItem[];
  opportunities: CombinationOpportunity[];
  manualFeedback: ManualFeedback[];
  evidence: EvidenceRecord[];
  validation: ValidationReport;
};

type NormalizedSlot = { slot: SlotKind; primary: string; variants: string[] };
type NormalizedMatch = LocalMatch & { slots: NormalizedSlot[] };

const atomFields: Array<{ key: keyof LocalAnalysis["payload"]; field: VisionField }> = [
  { key: "silhouetteTags", field: "silhouette" },
  { key: "materialTags", field: "material" },
  { key: "patternTags", field: "pattern" },
  { key: "styleTags", field: "style" },
  { key: "designHighlights", field: "design_highlight" },
];

const conceptGroups: Array<{ broader: string; terms: string[] }> = [
  { broader: "宽松体量", terms: ["宽松", "廓形", "阔腿", "oversize", "落肩", "茧型", "伞形"] },
  { broader: "收束线条", terms: ["修身", "直筒", "利落", "窄", "贴身", "短款"] },
  { broader: "机能表达", terms: ["机能", "功能", "防水", "多口袋", "工装", "尼龙", "科技"] },
  { broader: "正式表达", terms: ["正式", "西装", "衬衫", "领带", "优雅", "精致"] },
  { broader: "松弛表达", terms: ["松弛", "休闲", "运动", "慵懒", "街头", "随性"] },
  { broader: "设计焦点", terms: ["拼接", "印花", "刺绣", "解构", "褶皱", "金属", "图案", "亮点"] },
  { broader: "轻盈材质", terms: ["轻薄", "飘逸", "透", "薄", "柔软", "垂坠"] },
  { broader: "厚重材质", terms: ["厚重", "硬挺", "粗粝", "皮革", "重磅", "挺括"] },
  { broader: "基础承接", terms: ["基础款", "基础", "百搭", "纯色", "简洁", "低调"] },
];

const conceptRelations: ConceptRelation[] = conceptGroups.flatMap((group) =>
  group.terms.map((term) => ({ from: term, to: group.broader, kind: "broader" as const, version: CONCEPT_GRAPH_VERSION })),
);

const stableText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const stableNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const unique = <T,>(values: T[]) => [...new Set(values)];
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const fnv1a = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};
const idFor = (...parts: unknown[]) => parts.map((part) => stableText(part) || String(part ?? "")).join(":");
const normalizeTerm = (value: string) => value.toLowerCase().replace(/[\s·•/\\—_-]+/g, "").trim();
const splitAtoms = (value: string) => value.split(/[，,]/).map((part) => part.trim()).filter(Boolean);

export function snapshotFingerprint(snapshot: LocalSnapshot) {
  const compact = JSON.stringify({
    schemaVersion: snapshot.schemaVersion,
    wardrobeItems: snapshot.wardrobeItems,
    bestMatches: snapshot.bestMatches,
    visionAnalyses: snapshot.visionAnalyses,
  });
  return `local-fnv1a-${fnv1a(compact)}`;
}

function normalizeSlots(match: LocalMatch): NormalizedSlot[] {
  const slots: NormalizedSlot[] = [];
  Object.entries(match.items || {}).forEach(([slot, entries]) => {
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const raw = typeof entry === "string" ? { primary: entry, variants: [] } : (entry || {}) as LocalSlot;
      const primary = stableText(raw.primary);
      if (!primary) return;
      slots.push({
        slot,
        primary,
        variants: unique((Array.isArray(raw.variants) ? raw.variants : []).map(stableText).filter(Boolean)),
      });
    });
  });
  return slots;
}

export function normalizeMatches(matches: LocalMatch[]): NormalizedMatch[] {
  return matches.map((match) => ({ ...match, slots: normalizeSlots(match) }));
}

function linearRgb(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function rgbToLab(rgb: [number, number, number]): [number, number, number] {
  const [r, g, b] = rgb.map(linearRgb);
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (value: number) => value > 216 / 24389 ? Math.cbrt(value) : (24389 / 27 * value + 16) / 116;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function rgbToOklch(rgb: [number, number, number]): [number, number, number] {
  const [r, g, b] = rgb.map(linearRgb);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l3 = Math.cbrt(l);
  const m3 = Math.cbrt(m);
  const s3 = Math.cbrt(s);
  const lightness = 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3;
  const a = 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3;
  const bb = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3;
  const chroma = Math.sqrt(a * a + bb * bb);
  const hue = (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360;
  return [lightness, chroma, hue];
}

export function deltaE76(left: [number, number, number], right: [number, number, number]) {
  return Math.sqrt(left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0));
}

function atomsFromAnalysis(analysis: LocalAnalysis): SemanticAtom[] {
  if (analysis.status === "rejected" || analysis.status === "failed") return [];
  const status = analysis.status === "confirmed" ? "confirmed" : "proposed";
  const weight = status === "confirmed" ? 1 : 0.55;
  const atoms: SemanticAtom[] = [];
  atomFields.forEach(({ key, field }) => {
    const values = analysis.payload[key];
    if (!Array.isArray(values)) return;
    values.forEach((tag, parentIndex) => {
      splitAtoms(tag.value).forEach((value, atomIndex) => atoms.push({
        id: idFor("atom", analysis.itemId, field, parentIndex, atomIndex, fnv1a(value)),
        itemId: analysis.itemId,
        field,
        value,
        normalized: normalizeTerm(value),
        parentValue: tag.value,
        parentIndex,
        atomIndex,
        source: tag.source || "vision_model",
        evidenceStatus: status,
        weight,
      }));
    });
  });
  (["visualWeight", "formality"] as const).forEach((key) => {
    const tag = analysis.payload[key];
    if (!tag?.value) return;
    const field: VisionField = key === "visualWeight" ? "visual_weight" : "formality";
    splitAtoms(tag.value).forEach((value, atomIndex) => atoms.push({
      id: idFor("atom", analysis.itemId, field, 0, atomIndex, fnv1a(value)),
      itemId: analysis.itemId,
      field,
      value,
      normalized: normalizeTerm(value),
      parentValue: tag.value,
      parentIndex: 0,
      atomIndex,
      source: tag.source || "vision_model",
      evidenceStatus: status,
      weight,
    }));
  });
  return atoms;
}

function colorsFromAnalysis(analysis: LocalAnalysis): PerceptualColor[] {
  if (analysis.status === "rejected" || analysis.status === "failed") return [];
  return analysis.payload.dominantColors.map((color) => ({
    itemId: analysis.itemId,
    rgb: color.rgb,
    hex: color.hex,
    role: color.role,
    areaRatio: color.areaRatio,
    lab: rgbToLab(color.rgb),
    oklch: rgbToOklch(color.rgb),
    source: color.source,
  }));
}

const clauseSplit = (text: string) => text.split(/(?<=[。！？!?；;])/).map((value) => value.trim()).filter(Boolean);
const textClaimRules: Array<{ type: TextClaimType; terms: string[] }> = [
  { type: "aversion", terms: ["不喜欢", "不适合", "不能", "不搭", "违和", "避免", "缺点", "无法驾驭"] },
  { type: "preference", terms: ["喜欢", "最爱", "偏爱", "欣赏", "满意", "好看"] },
  { type: "emotion_identity", terms: ["纪念", "故事", "朋友", "旅行", "礼物", "身份", "意义", "回忆"] },
  { type: "function_comfort", terms: ["舒服", "舒适", "实用", "保暖", "透气", "耐穿", "防水"] },
  { type: "body_constraint", terms: ["显高", "显瘦", "腿长", "肩宽", "比例", "身形", "修饰", "压身高"] },
  { type: "core_item", terms: ["核心", "围绕", "主角", "重点", "主体"] },
  { type: "color_operation", terms: ["提亮", "同色", "呼应", "颜色", "色彩", "黑白", "撞色"] },
  { type: "proportion_operation", terms: ["上窄下宽", "上宽下窄", "长短", "体量", "重心", "线条", "层次", "比例"] },
  { type: "material_operation", terms: ["材质", "面料", "厚重", "轻盈", "飘逸", "硬挺", "垂坠"] },
  { type: "formality_operation", terms: ["正式", "休闲", "松弛", "优雅", "街头"] },
  { type: "substitution_reason", terms: ["替换", "换成", "变体", "都可以", "也能"] },
  { type: "scene", terms: ["适合", "场景", "上班", "通勤", "约会", "旅行", "日常"] },
];

export function extractDeterministicTextClaims(snapshot: LocalSnapshot): TextClaim[] {
  const sources = [
    ...snapshot.wardrobeItems.map((item) => ({ sourceType: "item" as const, sourceId: item.id, text: stableText(item.story) })),
    ...snapshot.bestMatches.map((match) => ({ sourceType: "best_match" as const, sourceId: match.id, text: stableText(match.story) })),
  ];
  const claims: TextClaim[] = [];
  sources.forEach((source) => {
    clauseSplit(source.text).forEach((quote, clauseIndex) => {
      const matches = textClaimRules.filter((rule) => rule.terms.some((term) => quote.includes(term)));
      matches.slice(0, 2).forEach((rule, ruleIndex) => claims.push({
        id: idFor("claim", source.sourceType, source.sourceId, clauseIndex, ruleIndex, rule.type),
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        sourceHash: fnv1a(source.text),
        quote,
        type: rule.type,
        subjectItemIds: source.sourceType === "item" ? [source.sourceId] : [],
        confidence: matches.length === 1 ? 0.86 : 0.72,
        status: "candidate",
        extractor: "deterministic",
        modelVersion: AESTHETIC_ENGINE_VERSION,
        promptVersion: TEXT_PROMPT_VERSION,
      }));
    });
  });
  return claims;
}

export function validateTextClaims(snapshot: LocalSnapshot, claims: TextClaim[]) {
  const sourceText = new Map<string, string>([
    ...snapshot.wardrobeItems.map((item) => [`item:${item.id}`, stableText(item.story)] as const),
    ...snapshot.bestMatches.map((match) => [`best_match:${match.id}`, stableText(match.story)] as const),
  ]);
  return claims.filter((claim) => {
    if (claim.sourceType === "manual") return Boolean(claim.quote && claim.status !== "rejected");
    const text = sourceText.get(`${claim.sourceType}:${claim.sourceId}`) || "";
    return Boolean(claim.quote && text.includes(claim.quote));
  });
}

function semanticConcepts(atoms: SemanticAtom[]) {
  const values = atoms.map((atom) => atom.normalized);
  return conceptGroups.filter((group) => group.terms.some((term) => values.some((value) => value.includes(normalizeTerm(term))))).map((group) => group.broader);
}

function ratingOf(item?: LocalItem) {
  const rating = stableNumber(item?.rating);
  return rating === null ? null : clamp(rating, 0, 10);
}

function evidenceForInputs(
  items: LocalItem[],
  analyses: LocalAnalysis[],
  atoms: SemanticAtom[],
  colors: PerceptualColor[],
  matches: NormalizedMatch[],
  claims: TextClaim[],
  calibrations: OutfitCalibration[],
): EvidenceRecord[] {
  const evidence: EvidenceRecord[] = [];
  atoms.forEach((atom) => evidence.push({
    id: `e:${atom.id}`,
    kind: "field",
    sourceId: atom.itemId,
    label: `${atom.field} · ${atom.value}`,
    status: atom.evidenceStatus,
    weight: atom.weight,
    detail: atom.parentValue === atom.value ? undefined : `原始组：${atom.parentValue}`,
  }));
  colors.forEach((color) => evidence.push({
    id: colorEvidenceId(color),
    kind: "color",
    sourceId: color.itemId,
    label: `${color.role} · ${color.hex} · RGB(${color.rgb.join(",")})`,
    status: analyses.find((analysis) => analysis.itemId === color.itemId)?.status === "confirmed" ? "confirmed" : "proposed",
    weight: analyses.find((analysis) => analysis.itemId === color.itemId)?.status === "confirmed" ? 1 : 0.55,
    detail: `OKLCH(${color.oklch.map((value) => value.toFixed(3)).join(", ")})`,
  }));
  items.forEach((item) => {
    const rating = ratingOf(item);
    if (rating !== null) evidence.push({ id: idFor("e:rating", item.id), kind: "rating", sourceId: item.id, label: `综合评分 ${rating}/10`, status: "confirmed", weight: 1, detail: "综合欣赏程度；不等同于设计质量或搭配兼容度" });
  });
  claims.forEach((claim) => evidence.push({ id: `e:${claim.id}`, kind: "story_quote", sourceId: claim.sourceId, label: claim.type, quote: claim.quote, status: "direct_text", weight: claim.status === "confirmed" ? 1 : 0.9, detail: `${claim.extractor} · ${claim.status}` }));
  matches.forEach((match) => match.slots.forEach((slot) => {
    evidence.push({ id: idFor("e:slot", match.id, slot.slot, slot.primary), kind: "match_slot", sourceId: match.id, label: `${match.name || "未命名搭配"} · ${slot.slot} 主件`, status: "confirmed", weight: 1, detail: items.find((item) => item.id === slot.primary)?.name || slot.primary });
    slot.variants.forEach((variant) => evidence.push({ id: idFor("e:variant", match.id, slot.slot, slot.primary, variant), kind: "variant", sourceId: match.id, label: `${match.name || "未命名搭配"} · ${slot.slot} 槽位变体`, status: "confirmed", weight: 1, detail: `${items.find((item) => item.id === slot.primary)?.name || slot.primary} → ${items.find((item) => item.id === variant)?.name || variant}` }));
  }));
  calibrations.forEach((calibration) => evidence.push({ id: idFor("e:calibration", calibration.matchId), kind: "calibration", sourceId: calibration.matchId, label: `${calibration.confirmedByUser ? "人工" : "默认"}核心校准 · ${calibration.tier}`, status: calibration.confirmedByUser ? "confirmed" : "derived", weight: calibration.confirmedByUser ? 1 : 0.8, detail: calibration.anchorItemId }));
  return evidence;
}

function dominantColor(colors: PerceptualColor[], itemId: string) {
  return colors.find((color) => color.itemId === itemId && color.role === "dominant") || colors.find((color) => color.itemId === itemId);
}

// The stored RGB remains the fact. This is only a readable, repeatable bucket for
// aggregation; it never replaces the original colour or its role in the item.
function colorFamily(color: PerceptualColor): ColorFamily {
  const [lightness, chroma, hue] = color.oklch;
  if (chroma < 0.035) {
    if (lightness < 0.28) return "黑";
    if (lightness > 0.9) return "白";
    return "灰";
  }
  if (lightness > 0.87 && chroma < 0.1) return "米";
  if (hue >= 20 && hue < 65 && lightness < 0.58) return "棕";
  if (hue < 20 || hue >= 345) return "红";
  if (hue < 48) return "橙";
  if (hue < 98) return "黄";
  if (hue < 165) return "绿";
  if (hue < 205) return "青";
  if (hue < 268) return "蓝";
  if (hue < 318) return "紫";
  return "粉";
}

function colorFamilyLabel(family: ColorFamily) {
  return family === "未知" ? "未归类颜色" : `${family}色`;
}

function closestRoleAwareColorPair(colors: PerceptualColor[], leftItemId: string, rightItemId: string) {
  const left = colors.filter((color) => color.itemId === leftItemId);
  const right = colors.filter((color) => color.itemId === rightItemId);
  return left.flatMap((leftColor) => right.map((rightColor) => ({ leftColor, rightColor, score: deltaE76(leftColor.lab, rightColor.lab) + (leftColor.role === rightColor.role ? 0 : 4) }))).sort((a, b) => a.score - b.score)[0];
}

function colorEvidenceId(color: PerceptualColor) {
  return idFor("e:color", color.itemId, color.role, color.rgb.join("-"));
}

function operationRelations(
  match: NormalizedMatch,
  anchorId: string,
  atomsByItem: Map<string, SemanticAtom[]>,
  colors: PerceptualColor[],
  claims: TextClaim[],
): OutfitRelation[] {
  const anchorAtoms = atomsByItem.get(anchorId) || [];
  const anchorConcepts = semanticConcepts(anchorAtoms);
  // Candidate text stays visible for review but must not change a formal relation.
  const matchClaims = claims.filter((claim) => claim.sourceType === "best_match" && claim.sourceId === match.id && claim.status === "confirmed");
  const relations: OutfitRelation[] = [];
  match.slots.filter((slot) => slot.primary !== anchorId).forEach((slot) => {
    const supportAtoms = atomsByItem.get(slot.primary) || [];
    const supportConcepts = semanticConcepts(supportAtoms);
    const colorPair = closestRoleAwareColorPair(colors, anchorId, slot.primary);
    const anchorColor = colorPair?.leftColor;
    const supportColor = colorPair?.rightColor;
    const evidenceIds = [idFor("e:slot", match.id, slot.slot, slot.primary)];
    const add = (operation: OutfitRelation["operation"], effect: string, confidence: number, extra: string[] = []) => relations.push({
      id: idFor("relation", match.id, anchorId, slot.primary, operation), matchId: match.id, anchorItemId: anchorId, supportItemId: slot.primary, slot: slot.slot, operation, effect, evidenceIds: unique([...evidenceIds, ...extra]), confidence,
    });
    add("anchor_support", "围绕核心外衣完成该槽位的承接", 1);
    if (anchorColor && supportColor) {
      const distance = deltaE76(anchorColor.lab, supportColor.lab);
      const lightDifference = supportColor.oklch[0] - anchorColor.oklch[0];
      const colorEvidence = [colorEvidenceId(anchorColor), colorEvidenceId(supportColor)];
      if (distance < 18) add("color_echo", "以相近感知色维持连续和统一", 0.78, colorEvidence);
      else if (lightDifference > 0.28) add("color_lighten", "以更高明度的支持件提亮核心", 0.74, colorEvidence);
      else if (lightDifference < -0.28) add("color_ground", "以更低明度的支持件收束并压住重心", 0.74, colorEvidence);
    }
    if (anchorConcepts.includes("宽松体量") && supportConcepts.includes("收束线条") || anchorConcepts.includes("收束线条") && supportConcepts.includes("宽松体量")) add("volume_balance", "通过相反体量建立比例平衡", 0.72);
    if (anchorConcepts.includes("轻盈材质") && supportConcepts.includes("轻盈材质")) add("material_harmony", "延续轻盈或垂坠的材质语气", 0.7);
    if (anchorConcepts.includes("轻盈材质") && supportConcepts.includes("厚重材质") || anchorConcepts.includes("厚重材质") && supportConcepts.includes("轻盈材质")) add("material_tension", "以轻重材质差形成受控张力", 0.68);
    if (anchorConcepts.includes("正式表达") && supportConcepts.includes("松弛表达") || anchorConcepts.includes("松弛表达") && supportConcepts.includes("正式表达")) add("formality_adjust", "调节整体正式度，保留松弛与秩序之间的张力", 0.76);
    if (anchorConcepts.includes("设计焦点") && (supportConcepts.includes("基础承接") || supportAtoms.filter((atom) => atom.field === "design_highlight").length === 0)) add("focus_control", "让支持件降低竞争，保留核心设计焦点", 0.76);
  });
  matchClaims.forEach((claim) => {
    const op: OutfitRelation["operation"] | null = claim.type === "color_operation" ? "color_echo" : claim.type === "proportion_operation" ? "line_continue" : claim.type === "material_operation" ? "material_tension" : claim.type === "formality_operation" ? "formality_adjust" : claim.type === "emotion_identity" ? "identity_expression" : null;
    if (!op) return;
    const target = match.slots.find((slot) => slot.primary !== anchorId)?.primary;
    if (!target) return;
    relations.push({ id: idFor("relation:text", match.id, claim.id), matchId: match.id, anchorItemId: anchorId, supportItemId: target, slot: "outfit", operation: op, effect: claim.quote, evidenceIds: [`e:${claim.id}`], confidence: claim.status === "confirmed" ? 1 : 0.9 });
  });
  return relations;
}

function defaultCalibration(match: NormalizedMatch): OutfitCalibration {
  const anchor = match.slots.find((slot) => slot.slot === "tops")?.primary || match.slots[0]?.primary || "";
  return { matchId: match.id, anchorItemId: anchor, tier: "mature", confirmedByUser: false };
}

function decisionMechanismsForOutfit(outfit: Omit<OutfitCaseGraph, "decisionMechanisms">): DecisionMechanism[] {
  const groups = new Map<DecisionMechanism["operation"], OutfitRelation[]>();
  outfit.relations.filter((relation) => relation.operation !== "anchor_support").forEach((relation) => {
    const operation = relation.operation as DecisionMechanism["operation"];
    groups.set(operation, [...(groups.get(operation) || []), relation]);
  });
  const candidates = [...groups.entries()].map(([operation, relations]) => {
    const copy = friendlyMechanismCopy[operation] || mechanismCopy[operation];
    const directText = relations.some((relation) => relation.id.startsWith("relation:text"));
    const supportItemIds = unique(relations.map((relation) => relation.supportItemId));
    const genericColorEcho = operation === "color_echo" && !directText;
    const priority = ({
      focus_control: 1.3,
      volume_balance: 1.2,
      formality_adjust: 1.1,
      color_ground: 1,
      color_lighten: 1,
      material_tension: 0.9,
      line_continue: 0.9,
      identity_expression: 0.9,
      material_harmony: 0.45,
      color_echo: 0.35,
    } as Record<DecisionMechanism["operation"], number>)[operation];
    return {
      id: idFor("decision", outfit.matchId, operation),
      ruleId: `principle:${operation}`,
      caseId: outfit.matchId,
      operation,
      condition: copy?.condition || "当前的服装信息支持这项处理。",
      action: copy?.mechanism || operation,
      effect: unique(relations.map((relation) => relation.effect)).join("；"),
      supportItemIds,
      slots: unique(relations.map((relation) => relation.slot)),
      evidenceIds: unique(relations.flatMap((relation) => relation.evidenceIds)),
      sourceRelationIds: relations.map((relation) => relation.id),
      confidence: Math.max(...relations.map((relation) => relation.confidence)),
      status: directText ? "confirmed_intent" as const : genericColorEcho ? "fact" as const : "derived" as const,
      rank: priority + (directText ? 1 : 0) + Math.min(0.25, (supportItemIds.length - 1) * 0.1) + Math.max(...relations.map((relation) => relation.confidence)) * 0.1,
      genericColorEcho,
    };
  });
  const chosen = candidates.filter((candidate) => !candidate.genericColorEcho && candidate.status !== "fact").sort((left, right) => right.rank - left.rank);
  const selected = new Set(chosen.slice(0, 3).map((candidate) => candidate.id));
  return candidates.map(({ rank: _rank, genericColorEcho: _genericColorEcho, ...candidate }) => ({
    ...candidate,
    role: selected.has(candidate.id) ? candidate.id === chosen[0]?.id ? "dominant" : "supporting" : "structural",
  }));
}

function firstDimension(atoms: SemanticAtom[], field: VisionField, groups: Array<[string, string]>, fallback = "unknown") {
  const values = atoms.filter((atom) => atom.field === field).map((atom) => atom.normalized);
  return groups.find(([, term]) => values.some((value) => value.includes(normalizeTerm(term))))?.[0] || fallback;
}

function compositionForOutfit(match: NormalizedMatch, anchorId: string, atomsByItem: Map<string, SemanticAtom[]>, colors: PerceptualColor[]): OutfitCompositionProfile {
  const slotItem = (slot: string) => match.slots.find((entry) => entry.slot === slot)?.primary;
  const topId = slotItem("tops") || anchorId;
  const bottomId = slotItem("bottoms");
  const shoeId = slotItem("shoes");
  const topAtoms = atomsByItem.get(topId) || [];
  const bottomAtoms = bottomId ? atomsByItem.get(bottomId) || [] : [];
  const shoeAtoms = shoeId ? atomsByItem.get(shoeId) || [] : [];
  const width: Array<[string, string]> = [["wide", "宽松"], ["wide", "阔腿"], ["wide", "廓形"], ["wide", "oversize"], ["clean", "修身"], ["clean", "直筒"], ["clean", "利落"]];
  const length: Array<[string, string]> = [["long", "长款"], ["long", "长"], ["short", "短款"], ["short", "短"]];
  const ankle: Array<[string, string]> = [["closed", "束脚"], ["closed", "收口"], ["open", "拖地"], ["open", "阔腿"]];
  const shoeWeight: Array<[string, string]> = [["heavy", "厚底"], ["heavy", "厚重"], ["heavy", "重"], ["light", "轻"], ["light", "薄底"]];
  const roleCount = (role: LocalColor["role"]) => colors.filter((color) => match.slots.some((slot) => slot.primary === color.itemId) && color.role === role).length;
  const itemIds = match.slots.map((slot) => slot.primary);
  const highlightedItemIds = itemIds.filter((itemId) => (atomsByItem.get(itemId) || []).some((atom) => atom.field === "design_highlight"));
  const anchorHasHighlight = highlightedItemIds.includes(anchorId);
  // A reviewed design-highlight field means that an item has a detail worth
  // recording. It does not by itself make every detail the focus of the outfit.
  // Victor's confirmed core-outerwear premise therefore decides the primary
  // focus; support details remain visible as secondary evidence.
  const focusItemIds = anchorHasHighlight ? [anchorId] : highlightedItemIds;
  const supportDetailItemIds = anchorHasHighlight ? highlightedItemIds.filter((itemId) => itemId !== anchorId) : [];
  const distribution = anchorHasHighlight ? "core_led" : focusItemIds.length ? "support_led" : "quiet";
  const palette = colors.filter((color) => itemIds.includes(color.itemId)).map((color) => ({
    itemId: color.itemId,
    role: color.role,
    family: colorFamily(color),
    hex: color.hex,
  }));
  const focusId = focusItemIds[0] || anchorId;
  return {
    topWidth: firstDimension(topAtoms, "silhouette", width) as OutfitCompositionProfile["topWidth"],
    topLength: firstDimension(topAtoms, "silhouette", length, "regular") as OutfitCompositionProfile["topLength"],
    bottomWidth: firstDimension(bottomAtoms, "silhouette", width) as OutfitCompositionProfile["bottomWidth"],
    bottomLength: firstDimension(bottomAtoms, "silhouette", length, "regular") as OutfitCompositionProfile["bottomLength"],
    ankleFinish: firstDimension(bottomAtoms, "silhouette", ankle) as OutfitCompositionProfile["ankleFinish"],
    shoeWeight: firstDimension(shoeAtoms, "visual_weight", shoeWeight) as OutfitCompositionProfile["shoeWeight"],
    colorRoles: { dominant: roleCount("dominant"), secondary: roleCount("secondary"), accent: roleCount("accent") },
    colorPalette: palette,
    designFocus: {
      distribution,
      focusItemIds,
      supportDetailItemIds,
      focusHighlights: unique(focusItemIds.flatMap((itemId) => (atomsByItem.get(itemId) || []).filter((atom) => atom.field === "design_highlight").map((atom) => atom.value))),
    },
    focusItemId: focusId,
  };
}

function buildOutfitCases(
  matches: NormalizedMatch[],
  items: Map<string, LocalItem>,
  atoms: SemanticAtom[],
  colors: PerceptualColor[],
  claims: TextClaim[],
  calibrations: OutfitCalibration[],
): OutfitCaseGraph[] {
  const atomsByItem = new Map<string, SemanticAtom[]>();
  atoms.forEach((atom) => atomsByItem.set(atom.itemId, [...(atomsByItem.get(atom.itemId) || []), atom]));
  return matches.map((match) => {
    const calibration = calibrations.find((entry) => entry.matchId === match.id) || defaultCalibration(match);
    const relations = operationRelations(match, calibration.anchorItemId, atomsByItem, colors, claims);
    const fieldEvidence = match.slots.flatMap((slot) => (atomsByItem.get(slot.primary) || []).map((atom) => `e:${atom.id}`));
    const confirmed = fieldEvidence.filter((id) => atoms.find((atom) => `e:${atom.id}` === id)?.evidenceStatus === "confirmed").length;
    const caseGraph: Omit<OutfitCaseGraph, "decisionMechanisms"> = {
      matchId: match.id,
      name: match.name || "未命名搭配",
      story: stableText(match.story),
      anchorItemId: calibration.anchorItemId,
      anchorItemName: items.get(calibration.anchorItemId)?.name || calibration.anchorItemId,
      tier: calibration.tier,
      primaryItems: match.slots.map((slot) => ({ itemId: slot.primary, itemName: items.get(slot.primary)?.name || slot.primary, slot: slot.slot })),
      variantItems: match.slots.flatMap((slot) => slot.variants.map((variant) => ({ itemId: variant, itemName: items.get(variant)?.name || variant, slot: slot.slot, replacesItemId: slot.primary }))),
      relations,
      // Victor's "outerwear is the core" is a declared premise, not an inferred rule.
      mechanismKeys: unique(relations.filter((relation) => relation.operation !== "anchor_support").map((relation) => relation.operation)),
      explicitClaimIds: claims.filter((claim) => claim.sourceType === "best_match" && claim.sourceId === match.id && claim.status === "confirmed").map((claim) => claim.id),
      evidenceCoverage: fieldEvidence.length ? confirmed / fieldEvidence.length : 0,
      composition: compositionForOutfit(match, calibration.anchorItemId, atomsByItem, colors),
    };
    return { ...caseGraph, decisionMechanisms: decisionMechanismsForOutfit(caseGraph) };
  });
}

function sharedConcepts(left: SemanticAtom[], right: SemanticAtom[]) {
  const leftConcepts = semanticConcepts(left);
  const rightConcepts = semanticConcepts(right);
  return leftConcepts.filter((concept) => rightConcepts.includes(concept));
}

function substitutionContracts(cases: OutfitCaseGraph[], atoms: SemanticAtom[], colors: PerceptualColor[], evidence: EvidenceRecord[]): SubstitutionContract[] {
  const itemsById = new Map(cases.flatMap((outfit) => [...outfit.primaryItems, ...outfit.variantItems]).map((item) => [item.itemId, item.itemName]));
  const atomsByItem = new Map<string, SemanticAtom[]>();
  atoms.forEach((atom) => atomsByItem.set(atom.itemId, [...(atomsByItem.get(atom.itemId) || []), atom]));
  const grouped = new Map<string, { from: string; to: string; slot: SlotKind; matches: string[]; anchors: string[]; evidenceIds: string[] }>();
  cases.forEach((outfit) => outfit.variantItems.forEach((variant) => {
    const key = idFor(variant.replacesItemId, variant.itemId, variant.slot);
    const current = grouped.get(key) || { from: variant.replacesItemId, to: variant.itemId, slot: variant.slot, matches: [], anchors: [], evidenceIds: [] };
    current.matches.push(outfit.matchId);
    current.anchors.push(outfit.anchorItemId);
    current.evidenceIds.push(idFor("e:variant", outfit.matchId, variant.slot, variant.replacesItemId, variant.itemId));
    grouped.set(key, current);
  }));
  return [...grouped.values()].map((entry) => {
    const leftAtoms = atomsByItem.get(entry.from) || [];
    const rightAtoms = atomsByItem.get(entry.to) || [];
    const invariants = sharedConcepts(leftAtoms, rightAtoms);
    const leftFields = new Map(leftAtoms.map((atom) => [`${atom.field}:${atom.normalized}`, atom.value]));
    const rightFields = new Map(rightAtoms.map((atom) => [`${atom.field}:${atom.normalized}`, atom.value]));
    const changes = unique([...leftFields.keys(), ...rightFields.keys()].filter((key) => !leftFields.has(key) || !rightFields.has(key)).map((key) => key.split(":")[0])).map((field) => ({ silhouette: "廓形", material: "材质", pattern: "图案", style: "风格", design_highlight: "设计亮点", visual_weight: "视觉重量", formality: "正式度" }[field] || field));
    const leftColor = dominantColor(colors, entry.from);
    const rightColor = dominantColor(colors, entry.to);
    const effectChanges: string[] = [];
    if (leftColor && rightColor) {
      const distance = deltaE76(leftColor.lab, rightColor.lab);
      if (distance < 18) invariants.push("主色感知接近");
      else effectChanges.push(`主色改变（Lab ΔE ${distance.toFixed(1)}）`);
      const light = rightColor.oklch[0] - leftColor.oklch[0];
      if (light > 0.2) effectChanges.push("替换后整体更明亮");
      if (light < -0.2) effectChanges.push("替换后整体更沉稳");
    }
    if (!invariants.length) invariants.push("槽位功能保持不变；其他共同点待人工确认");
    if (!effectChanges.length && changes.length) effectChanges.push(`${changes.slice(0, 3).join("、")}发生变化，实际效果待确认`);
    const contextMatches = unique(entry.matches);
    const contextAnchors = unique(entry.anchors);
    return {
      id: idFor("sub", entry.from, entry.to, entry.slot),
      fromItemId: entry.from,
      fromItemName: itemsById.get(entry.from) || entry.from,
      toItemId: entry.to,
      toItemName: itemsById.get(entry.to) || entry.to,
      slot: entry.slot,
      contextMatchIds: contextMatches,
      contextAnchorIds: contextAnchors,
      invariants: unique(invariants),
      allowedChanges: unique(changes),
      effectChanges,
      boundary: contextAnchors.length > 1 ? `已在 ${contextAnchors.length} 个不同核心下成立，仍只对记录过的上下文负责。` : "当前只在一个核心外衣语境中成立，不能外推为全局可替换。",
      repeated: contextMatches.length > 1,
      evidenceIds: entry.evidenceIds.filter((id) => evidence.some((item) => item.id === id)),
    };
  }).sort((left, right) => right.contextMatchIds.length - left.contextMatchIds.length);
}

function applyHumanDecisionsToSubstitutions(contracts: SubstitutionContract[], feedback: ManualFeedback[]) {
  return contracts.map((contract) => {
    const decisions = feedback.filter((entry) => entry.targetType === "review" && entry.targetId === `review:sub:${contract.id}`);
    const restricted = decisions.find((entry) => entry.choice?.includes("只在当前上下文") || entry.choice?.includes("只在这一套里成立"));
    if (!restricted) return contract;
    return {
      ...contract,
      boundary: `${contract.boundary} 人工校准：只在当前已记录的搭配上下文中替换。${restricted.note ? ` ${restricted.note}` : ""}`,
    };
  });
}

const mechanismCopy: Record<string, { title: string; condition: string; mechanism: string; effect: string }> = {
  anchor_support: { title: "以外层上衣建立表达中心", condition: "当一套搭配从最外层上衣展开时", mechanism: "先固定核心，再让下装、鞋与配饰分别承担承接、平衡或点缀", effect: "让设计表达集中，同时保持整套可穿性" },
  focus_control: { title: "用低竞争支持件保护设计焦点", condition: "核心外衣已经拥有明显设计亮点时", mechanism: "让支持件降低图案或细节竞争，并负责收束", effect: "焦点清楚，基础件发挥功能价值而不会冒充审美核心" },
  formality_adjust: { title: "在正式与松弛之间制造受控张力", condition: "正式元素与街头、运动或宽松元素共同出现时", mechanism: "通过廓形、鞋履或下装调节正式度", effect: "保留秩序感，又避免整套过度拘束" },
  color_echo: { title: "让颜色承担连接而非堆叠", condition: "核心与支持件存在相近感知色或原文明确呼应时", mechanism: "用主色、辅色或点缀色跨槽位重复一个色彩关系", effect: "不同单品被读成同一整体" },
  color_lighten: { title: "用局部高明度打破沉闷", condition: "核心色较暗、支持件具有明显更高明度时", mechanism: "把亮色放在内搭、鞋履或配饰等局部位置", effect: "维持深色秩序，同时获得呼吸感" },
  color_ground: { title: "用深色支持件压住视觉重心", condition: "核心较亮或设计感较强时", mechanism: "让下装、鞋履或包具以低明度承托整体", effect: "表达不会漂浮，轮廓更稳定" },
  volume_balance: { title: "用相反体量修正整体比例", condition: "核心与支持件的松紧、宽窄存在明确差异时", mechanism: "通过上/下半身体量对照建立比例", effect: "避免整套同向膨胀或过度紧绷" },
  material_harmony: { title: "让材质语气连续", condition: "核心与支持件共享轻盈、垂坠或相近触感时", mechanism: "延续材质的软硬与动态方向", effect: "轮廓运动一致，整体更完整" },
  material_tension: { title: "以轻重材质差制造层次", condition: "轻盈与厚重材质被放在同一套搭配中时", mechanism: "保留一个共同的色彩或廓形约束，再改变材质重量", effect: "出现层次与张力，同时不失控制" },
  line_continue: { title: "延续纵向线条与重心", condition: "原文明示线条、长短、露出或层次操作时", mechanism: "通过裤长、内搭露出或鞋型继续核心的线条", effect: "比例与视觉方向更明确" },
  identity_expression: { title: "让搭配承载身份与故事", condition: "单品或搭配原文明确涉及人物、经历或身份时", mechanism: "把叙事价值放入整套表达中心", effect: "穿搭拥有个人真实性，而不只剩形式正确" },
};

const friendlyMechanismCopy: Record<string, { title: string; condition: string; mechanism: string; effect: string }> = {
  anchor_support: { title: "外衣是搭配重点", condition: "外衣有明显设计或风格时", mechanism: "裤子、鞋和配饰围绕外衣选择", effect: "搭配重点集中在外衣" },
  focus_control: { title: "外衣有重点，其他单品减少冲突", condition: "外衣有明显细节、图案或结构时", mechanism: "其他单品少用抢眼图案和细节", effect: "外衣的设计更清楚" },
  formality_adjust: { title: "用休闲元素调节正式度", condition: "正装元素与运动、街头或日常单品同时出现时", mechanism: "通过裤型、鞋履或配饰控制正式度的落点", effect: "保留正装的轮廓，同时避免整体显得拘谨" },
  color_echo: { title: "用色彩呼应建立整体感", condition: "两件单品存在相近色彩，或文字说明明确提到色彩呼应时", mechanism: "让主色、辅色或点缀色在不同槽位重复出现", effect: "不同单品形成可读的色彩关系" },
  color_lighten: { title: "以点缀色提亮深色基调", condition: "核心单品偏深，支持单品明显更亮时", mechanism: "把亮色放在内搭、鞋履或配饰等局部位置", effect: "保持深色的秩序，同时拉开明度层次" },
  color_ground: { title: "以低明度单品稳定视觉重心", condition: "核心外衣偏亮或设计焦点较强时", mechanism: "让下装、鞋履或包具承担更低明度的色彩重量", effect: "让重心落稳，避免焦点漂浮" },
  volume_balance: { title: "上、下半身用不同松紧", condition: "上、下半身宽窄或松紧不同", mechanism: "一边保留体量，另一边收窄线条", effect: "避免整套都宽或都紧" },
  material_harmony: { title: "材质轻重接近", condition: "单品的轻重、软硬或垂坠感相近时", mechanism: "选择触感和动态相近的单品", effect: "整体看起来更连贯" },
  material_tension: { title: "用不同材质增加层次", condition: "轻薄和厚重材质同时出现时", mechanism: "保留颜色或廓形的共同点，只改变材质", effect: "有层次，但不乱" },
  line_continue: { title: "用内搭、裤长或鞋延续线条", condition: "文字说明提到长短、露出或层次时", mechanism: "用裤长、内搭或鞋型接住外衣线条", effect: "比例更清楚" },
  identity_expression: { title: "搭配保留有故事的单品", condition: "单品或搭配说明提到人、经历或身份时", mechanism: "让这件单品留在搭配重点位置", effect: "搭配保留个人信息" },
};

function validationReport(cases: OutfitCaseGraph[], items: LocalItem[], atoms: SemanticAtom[], substitutions: SubstitutionContract[]): ValidationReport {
  const atomsByItem = new Map<string, SemanticAtom[]>();
  atoms.forEach((atom) => atomsByItem.set(atom.itemId, [...(atomsByItem.get(atom.itemId) || []), atom]));
  const slots = unique(cases.flatMap((outfit) => outfit.primaryItems.map((item) => item.slot)));
  const results: HoldoutSlotResult[] = [];
  slots.forEach((slot) => {
    let engineHits = 0;
    let baselineHits = 0;
    let count = 0;
    cases.forEach((held) => {
      const target = held.primaryItems.find((item) => item.slot === slot);
      if (!target) return;
      const training = cases.filter((outfit) => outfit.matchId !== held.matchId);
      const popularity = new Map<string, number>();
      training.forEach((outfit) => outfit.primaryItems.filter((item) => item.slot === slot).forEach((item) => popularity.set(item.itemId, (popularity.get(item.itemId) || 0) + 1)));
      const baseline = [...popularity].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
      if (baseline.includes(target.itemId)) baselineHits += 1;
      const anchorAtoms = target.itemId === held.anchorItemId
        ? held.primaryItems.filter((item) => item.itemId !== target.itemId).flatMap((item) => atomsByItem.get(item.itemId) || [])
        : atomsByItem.get(held.anchorItemId) || [];
      const candidates = items.filter((item) => popularity.has(item.id));
      const scored = candidates.map((item) => {
        const shared = sharedConcepts(anchorAtoms, atomsByItem.get(item.id) || []).length;
        const pairContexts = target.itemId === held.anchorItemId
          ? training.filter((outfit) => outfit.anchorItemId === item.id && held.primaryItems.some((heldItem) => heldItem.itemId !== target.itemId && outfit.primaryItems.some((entry) => entry.itemId === heldItem.itemId))).length
          : training.filter((outfit) => outfit.anchorItemId === held.anchorItemId && outfit.primaryItems.some((entry) => entry.itemId === item.id)).length;
        const variantContexts = target.itemId === held.anchorItemId ? 0 : substitutions.filter((contract) => contract.contextAnchorIds.includes(held.anchorItemId) && (contract.fromItemId === item.id || contract.toItemId === item.id)).length;
        return { id: item.id, score: pairContexts * 8 + variantContexts * 3 + shared * 1.5 + (popularity.get(item.id) || 0) * 0.25 };
      }).sort((a, b) => b.score - a.score).slice(0, 3).map((entry) => entry.id);
      if (scored.includes(target.itemId)) engineHits += 1;
      count += 1;
    });
    results.push({ slot, cases: count, engineTop3: engineHits, baselineTop3: baselineHits, engineRate: count ? engineHits / count : 0, baselineRate: count ? baselineHits / count : 0 });
  });
  const total = results.reduce((sum, result) => sum + result.cases, 0);
  const engine = results.reduce((sum, result) => sum + result.engineTop3, 0);
  const baseline = results.reduce((sum, result) => sum + result.baselineTop3, 0);
  const explained = cases.flatMap((outfit) => outfit.relations).filter((relation) => relation.evidenceIds.length > 0).length;
  const relationCount = cases.flatMap((outfit) => outfit.relations).length;
  return { slots: results, engineOverallRate: total ? engine / total : 0, baselineOverallRate: total ? baseline / total : 0, beatsBaseline: engine > baseline, explanationTraceRate: relationCount ? explained / relationCount : 0 };
}

function buildReviewQuestions(cases: OutfitCaseGraph[], substitutions: SubstitutionContract[], claims: TextClaim[], bodyProfileText: string): ReviewQuestion[] {
  const questions: ReviewQuestion[] = [];
  cases.forEach((outfit) => {
    // A dislike in the prose is not automatically a contradiction with the
    // existence of variants. Ask only when the same sentence explicitly puts a
    // restriction on replacement; otherwise the two facts are unrelated.
    const replacementConstraint = claims.find((claim) => claim.sourceType === "best_match" && claim.sourceId === outfit.matchId && claim.type === "substitution_reason" && /不|不能|只|仅|避免|限制/.test(`${claim.quote} ${claim.limitation || ""}`));
    if (replacementConstraint && outfit.variantItems.length) questions.push({
      id: idFor("review:conflict", outfit.matchId), priority: 1, kind: "text_structure_conflict",
      question: `「${outfit.name}」里，这句说明和已记录的替换，哪一个更接近你的真实想法？`,
      context: `你写过：“${replacementConstraint.quote}”；同时，这套里记录了 ${outfit.variantItems.length} 个可替换单品。`,
      whyItMatters: "你的回答会决定这些替换以后是保留为可用选择，还是只放在更窄的条件里。",
      sourceIds: [outfit.matchId, ...outfit.variantItems.map((item) => item.itemId)], options: ["替换可以成立，只是有条件", "这句说明更重要，替换应收窄"],
    });
  });
  const weakAnchor = cases.find((outfit) => !outfit.anchorItemId || outfit.primaryItems.filter((item) => item.slot === "tops").length > 1);
  if (weakAnchor) questions.push({
    id: idFor("review:anchor", weakAnchor.matchId), priority: 3, kind: "anchor_unclear",
    question: `「${weakAnchor.name}」里，真正的主角是哪件上衣？`,
    context: `系统暂时选了「${weakAnchor.anchorItemName}」，但这套有不止一层上装。`,
    whyItMatters: "主角选对了，之后围绕这件外衣找裤子、鞋和替换才不会跑偏。",
    sourceIds: [weakAnchor.matchId], options: ["现在选对了", "主角应换成另一件上衣"],
  });
  if (bodyProfileText.trim()) questions.push({
    id: "review:body:first", priority: 4, kind: "body_effect", question: "你写下的穿衣诉求，已经在哪一套里真正实现了？",
    context: `你写的是：${bodyProfileText.slice(0, 180)}`,
    whyItMatters: "你确认过的实穿感受，才能把“看起来合理”变成真正适合你的搭配经验。",
    sourceIds: cases.slice(0, 3).map((outfit) => outfit.matchId), options: ["已经有代表作", "还没有，需要继续试"],
  });
  const near = substitutions.find((contract) => !contract.repeated && contract.invariants.length > 1) || substitutions.find((contract) => !contract.repeated);
  if (near) questions.push({
    id: idFor("review:sub", near.id), priority: 5, kind: "near_substitution",
    question: `「${near.toItemName}」换掉「${near.fromItemName}」后，这个做法能带到别的搭配里吗？`,
    context: `${near.boundary} 这次替换保留了：${near.invariants.join("、") || "还需要你补充"}`,
    whyItMatters: "这会划清“这两件本来就相似”和“它们只在这件外衣下面刚好能换”的边界。",
    sourceIds: [near.fromItemId, near.toItemId, ...near.contextMatchIds], options: ["类似场景也愿意这样换", "只在这一套里成立"],
  });
  const ambiguous = claims.find((claim) => claim.confidence < 0.8);
  if (ambiguous) questions.push({
    id: idFor("review:semantic", ambiguous.id), priority: 2, kind: "semantic_ambiguity", question: "这段话被理解对了吗？",
    context: `你原来写的是：“${ambiguous.quote}”`,
    whyItMatters: "只有你认可的原话解释，才会进入以后关于偏好和搭配思路的结论。",
    sourceIds: [ambiguous.sourceId], options: ["理解得对", "我想自己重新说明"],
  });
  return questions.sort((a, b) => a.priority - b.priority || Number(b.context.includes("无法驾驭")) - Number(a.context.includes("无法驾驭"))).slice(0, 5);
}

function buildPrinciples(cases: OutfitCaseGraph[], validation: ValidationReport, questions: ReviewQuestion[]): AestheticPrinciple[] {
  const grouped = new Map<string, OutfitCaseGraph[]>();
  cases.forEach((outfit) => outfit.mechanismKeys.forEach((key) => grouped.set(key, [...(grouped.get(key) || []), outfit])));
  return [...grouped.entries()].map(([key, support]) => {
    const copy = friendlyMechanismCopy[key] || mechanismCopy[key] || friendlyMechanismCopy.anchor_support;
    const matches = unique(support.map((outfit) => outfit.matchId));
    const anchors = unique(support.map((outfit) => outfit.anchorItemId));
    const explicit = support.some((outfit) => outfit.explicitClaimIds.length > 0);
    const criticalConflictCount = questions.filter((question) => question.priority === 1 && question.sourceIds.some((id) => matches.includes(id))).length;
    const keyConflict = criticalConflictCount / Math.max(matches.length, 1) >= 0.25;
    const textOnly = support.every((outfit) => outfit.relations.filter((relation) => relation.operation === key).every((relation) => relation.id.startsWith("relation:text")));
    // Confirmed wording can tell us what Victor consciously intended, but it does
    // not replace repeated behavioural evidence. "常穿规律" is deliberately kept
    // behind the same three-case / two-core gate for every mechanism.
    const stable = matches.length >= 3 && anchors.length >= 2 && validation.beatsBaseline && !keyConflict && (!textOnly || explicit);
    const kind: PrincipleKind = stable ? "enacted" : explicit ? "self_aware" : matches.length >= 2 ? "emerging" : "case_only";
    const supportNote = stable
      ? `已满足 3 套搭配、${anchors.length} 件核心外衣与留出验证门槛。`
      : matches.length === 2
        ? "目前只有 2 套支撑案例，显示为初步模式；再出现 1 套且覆盖另一件核心外衣后，才会评估为常穿规律。"
        : explicit
          ? "这是你明确写过的搭配意图；目前案例数不足，不能当作常穿规律。"
          : "目前只有单套案例，保留为案例机制，不外推。";
    return {
      id: `principle:${key}`,
      title: copy.title,
      statement: `条件：${copy.condition}。做法：${copy.mechanism}。结果：${copy.effect}。`,
      condition: copy.condition,
      mechanism: copy.mechanism,
      effect: copy.effect,
      kind,
      supportMatchIds: matches,
      representativeMatchIds: support.filter((outfit) => outfit.tier === "representative").map((outfit) => outfit.matchId).concat(matches.slice(0, 3)).filter((id, index, all) => all.indexOf(id) === index).slice(0, 3),
      evidenceIds: unique(support.flatMap((outfit) => outfit.relations.filter((relation) => relation.operation === key).flatMap((relation) => relation.evidenceIds))).slice(0, 24),
      counterexampleMatchIds: [],
      unresolvedQuestionIds: questions.filter((question) => question.sourceIds.some((id) => matches.includes(id))).map((question) => question.id),
      confirmedCoverage: support.reduce((sum, outfit) => sum + outfit.evidenceCoverage, 0) / support.length,
      holdoutSupport: validation.beatsBaseline,
      supportNote,
      decisionMechanismIds: [],
      reconnectedEvidenceIds: [],
      reconnectionCoverage: 0,
      reconnectionStatus: "pending" as const,
      ruleValidation: { scope: "not_applicable" as const, slots: [], cases: 0, engineTop3: 0, baselineTop3: 0, passed: false, note: "v3 原则尚未连接到规则级验证。" },
    };
  }).sort((left, right) => {
    const order: Record<PrincipleKind, number> = { enacted: 5, self_aware: 4, emerging: 3, frontier: 2, case_only: 1 };
    return order[right.kind] - order[left.kind] || right.supportMatchIds.length - left.supportMatchIds.length;
  }).slice(0, 7);
}

function buildPotentials(items: LocalItem[], cases: OutfitCaseGraph[], evidence: EvidenceRecord[], feedback: ManualFeedback[]): PotentialItem[] {
  const counts = new Map<string, number>();
  const slots = new Map<string, Set<string>>();
  const anchorIds = new Set(cases.map((outfit) => outfit.anchorItemId));
  cases.forEach((outfit) => [...outfit.primaryItems, ...outfit.variantItems].forEach((item) => {
    counts.set(item.itemId, (counts.get(item.itemId) || 0) + 1);
    slots.set(item.itemId, new Set([...(slots.get(item.itemId) || []), item.slot]));
  }));
  const emotionalItemIds = new Set(feedback.filter((entry) => entry.targetType === "potential" && entry.choice === "它是情感收藏").map((entry) => entry.targetId));
  return items.map((item) => ({ item, rating: ratingOf(item), count: counts.get(item.id) || 0, observedSlots: [...(slots.get(item.id) || [])] }))
    // Every core outerwear legitimately has its own Best Match case. Its cross-
    // case frequency says nothing about whether it has been developed.
    .filter((entry) => !anchorIds.has(entry.item.id))
    .filter((entry) => (entry.rating || 0) >= 8 && entry.count <= 1 && !emotionalItemIds.has(entry.item.id)).map((entry) => ({
    itemId: entry.item.id,
    itemName: entry.item.name || entry.item.id,
    rating: entry.rating,
    matchCount: entry.count,
    observedSlots: entry.observedSlots,
    reason: entry.count === 0 ? "评分高，但还没有进入任何已记录 Best Match。它可能是尚未开发的内搭、下装、鞋或配饰，也可能本来只留给特定场景或情感记忆。" : `评分高，目前只在 ${entry.observedSlots.join("、") || "一个支持槽位"} 出现过一次。值得确认它是否还有别的搭配位置。`,
    evidenceIds: [idFor("e:rating", entry.item.id), ...evidence.filter((item) => item.sourceId === entry.item.id && item.kind === "story_quote").map((item) => item.id)].filter((id) => evidence.some((item) => item.id === id)),
  })).sort((left, right) => (right.rating || 0) - (left.rating || 0));
}

function inferredSlots(item: LocalItem): SlotKind[] {
  const category = stableText(item.category);
  if (category.includes("鞋")) return ["shoes"];
  if (category.includes("配饰") || category.includes("包") || category.includes("首饰")) return ["accessories"];
  if (category.includes("下装") || category.includes("裤") || category.includes("裙")) return ["bottoms"];
  if (category.includes("上装") || category.includes("内搭")) return ["tops"];
  return [];
}

function buildCombinationOpportunities(
  items: LocalItem[],
  cases: OutfitCaseGraph[],
  atoms: SemanticAtom[],
  colors: PerceptualColor[],
  feedback: ManualFeedback[],
): CombinationOpportunity[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const atomsByItem = new Map<string, SemanticAtom[]>();
  atoms.forEach((atom) => atomsByItem.set(atom.itemId, [...(atomsByItem.get(atom.itemId) || []), atom]));
  const historicSlots = new Map<string, Set<SlotKind>>();
  const pairedByAnchor = new Map<string, Set<string>>();
  cases.forEach((outfit) => {
    const paired = pairedByAnchor.get(outfit.anchorItemId) || new Set<string>();
    [...outfit.primaryItems, ...outfit.variantItems].forEach((item) => {
      paired.add(item.itemId);
      historicSlots.set(item.itemId, new Set([...(historicSlots.get(item.itemId) || []), item.slot]));
    });
    pairedByAnchor.set(outfit.anchorItemId, paired);
  });
  const result: CombinationOpportunity[] = [];
  // A local accept/reject is a decision about this exact core + slot + candidate
  // context. It must not be proposed again on the next run. A rejection is kept
  // as a counterexample, but its natural-language reason is not over-generalised
  // to neighbouring combinations without Victor confirming that broader rule.
  const decidedOpportunityIds = new Set(feedback
    .filter((entry) => entry.targetType === "opportunity" && (entry.choice === "接受" || entry.choice === "拒绝"))
    .map((entry) => entry.targetId));
  const functionCompatible = (target: LocalItem | undefined, candidate: LocalItem, slot: SlotKind) => {
    if (!target) return false;
    if (slot === "accessories") return Boolean(target.accessoryType && candidate.accessoryType && target.accessoryType === candidate.accessoryType);
    if (slot === "tops" && target.topType && candidate.topType) return target.topType === candidate.topType;
    return true;
  };
  const usefulConcepts = new Set(["宽松体量", "收束线条", "机能表达", "正式表达", "轻盈材质", "厚重材质", "设计焦点"]);
  cases.forEach((outfit) => {
    const paired = pairedByAnchor.get(outfit.anchorItemId) || new Set<string>();
    const targets = outfit.primaryItems.filter((item) => item.itemId !== outfit.anchorItemId && ["tops", "bottoms", "shoes", "accessories"].includes(item.slot));
    targets.forEach((target) => {
      const targetAtoms = atomsByItem.get(target.itemId) || [];
      const targetItem = itemsById.get(target.itemId);
      items.forEach((candidate) => {
        if (candidate.id === target.itemId || candidate.id === outfit.anchorItemId || paired.has(candidate.id)) return;
        if (!functionCompatible(targetItem, candidate, target.slot)) return;
        const candidateSlots = historicSlots.get(candidate.id) || new Set(inferredSlots(candidate));
        if (!candidateSlots.has(target.slot)) return;
        const candidateAtoms = atomsByItem.get(candidate.id) || [];
        const sharedWithTarget = sharedConcepts(targetAtoms, candidateAtoms).filter((concept) => usefulConcepts.has(concept));
        const pair = closestRoleAwareColorPair(colors, outfit.anchorItemId, candidate.id);
        const reasons: string[] = [];
        const evidenceIds = [idFor("e:slot", outfit.matchId, target.slot, target.itemId)];
        let compatibilitySignals = 0;
        if (sharedWithTarget.length) {
          compatibilitySignals += 1;
          reasons.push(`与现有${target.slot === "bottoms" ? "下装" : target.slot === "shoes" ? "鞋履" : target.slot === "accessories" ? "配饰" : "内搭"}共享${sharedWithTarget.slice(0, 2).join("、")}的结构或风格条件`);
          evidenceIds.push(...candidateAtoms.filter((atom) => semanticConcepts([atom]).some((concept) => sharedWithTarget.includes(concept))).map((atom) => `e:${atom.id}`));
        }
        if (pair) {
          const distance = deltaE76(pair.leftColor.lab, pair.rightColor.lab);
          const lightDifference = pair.rightColor.oklch[0] - pair.leftColor.oklch[0];
          const hasColorSignal = distance < 22 || lightDifference > 0.26 || lightDifference < -0.26;
          if (distance < 22) { reasons.push("与核心外衣存在相近色彩关系"); compatibilitySignals += 1; }
          else if (lightDifference > 0.26) { reasons.push("可在核心外衣之外形成更高明度的提亮"); compatibilitySignals += 1; }
          else if (lightDifference < -0.26) { reasons.push("可用更低明度承接核心外衣"); compatibilitySignals += 1; }
          if (hasColorSignal) evidenceIds.push(colorEvidenceId(pair.leftColor), colorEvidenceId(pair.rightColor));
        }
        const historicCount = cases.filter((caseItem) => caseItem.primaryItems.some((item) => item.itemId === candidate.id && item.slot === target.slot) || caseItem.variantItems.some((item) => item.itemId === candidate.id && item.slot === target.slot)).length;
        if (historicCount >= 2) reasons.push(`这件单品已在 ${historicCount} 套其他搭配中承担过同一槽位`);
        // A new pairing needs both a non-generic structural/style condition and
        // a meaningful relation to the core colour. Reuse elsewhere is only a
        // confidence boost, never a substitute for compatibility.
        if (compatibilitySignals < 2) return;
        const id = idFor("opportunity", outfit.anchorItemId, target.slot, candidate.id);
        if (decidedOpportunityIds.has(id)) return;
        result.push({
          id,
          anchorItemId: outfit.anchorItemId,
          anchorItemName: outfit.anchorItemName,
          targetSlot: target.slot,
          replacesItemId: target.itemId,
          replacesItemName: target.itemName,
          candidateItemId: candidate.id,
          candidateItemName: candidate.name || candidate.id,
          reasons: unique(reasons),
          evidenceIds: unique(evidenceIds),
          score: reasons.length + sharedWithTarget.length * 0.5 + Math.min(historicCount, 3) * 0.25,
        });
      });
    });
  });
  return result.sort((left, right) => right.score - left.score).slice(0, 12);
}

type SilhouetteShape = SilhouettePairingRule["topShape"];

function silhouetteShape(atoms: SemanticAtom[]): SilhouetteShape {
  const values = atoms.filter((atom) => atom.field === "silhouette").map((atom) => atom.normalized);
  const relaxed = ["宽松", "廓形", "阔腿", "oversize", "落肩", "茧型", "伞形", "宽摆"];
  const clean = ["修身", "窄", "贴身", "直筒", "收束", "合身", "利落"];
  const relaxedScore = values.reduce((score, value) => score + Number(relaxed.some((term) => value.includes(term))), 0);
  const cleanScore = values.reduce((score, value) => score + Number(clean.some((term) => value.includes(term))), 0);
  if (!relaxedScore && !cleanScore) return "mixed";
  if (relaxedScore === cleanScore) return "mixed";
  return relaxedScore > cleanScore ? "relaxed" : "clean";
}

function buildSilhouettePairingRules(cases: OutfitCaseGraph[], atoms: SemanticAtom[]): SilhouettePairingRule[] {
  const atomsByItem = new Map<string, SemanticAtom[]>();
  atoms.forEach((atom) => atomsByItem.set(atom.itemId, [...(atomsByItem.get(atom.itemId) || []), atom]));
  const groups = new Map<string, { topShape: SilhouetteShape; bottomShape: SilhouetteShape; cases: OutfitCaseGraph[]; evidenceIds: string[] }>();
  cases.forEach((outfit) => {
    const top = outfit.primaryItems.find((item) => item.itemId === outfit.anchorItemId) || outfit.primaryItems.find((item) => item.slot === "tops");
    const bottom = outfit.primaryItems.find((item) => item.slot === "bottoms");
    if (!top || !bottom) return;
    // Width is now read from the reviewed composition profile. Broad tag frequency
    // is retained only as source evidence, never as the proportion conclusion itself.
    const topShape: SilhouetteShape = outfit.composition.topWidth === "wide" ? "relaxed" : outfit.composition.topWidth === "clean" ? "clean" : "mixed";
    const bottomShape: SilhouetteShape = outfit.composition.bottomWidth === "wide" ? "relaxed" : outfit.composition.bottomWidth === "clean" ? "clean" : "mixed";
    if (topShape === "mixed" || bottomShape === "mixed") return;
    const key = `${topShape}:${bottomShape}`;
    const entry = groups.get(key) || { topShape, bottomShape, cases: [], evidenceIds: [] };
    entry.cases.push(outfit);
    entry.evidenceIds.push(
      idFor("e:slot", outfit.matchId, top.slot, top.itemId),
      idFor("e:slot", outfit.matchId, bottom.slot, bottom.itemId),
      ...(atomsByItem.get(top.itemId) || []).filter((atom) => atom.field === "silhouette").map((atom) => `e:${atom.id}`),
      ...(atomsByItem.get(bottom.itemId) || []).filter((atom) => atom.field === "silhouette").map((atom) => `e:${atom.id}`),
    );
    groups.set(key, entry);
  });
  const copy: Record<string, Pick<SilhouettePairingRule, "title" | "action">> = {
    "relaxed:clean": {
      title: "上装宽，下装窄",
      action: "外衣宽松时，下装使用更利落的线条。上半身保留体量，下半身收住。",
    },
    "clean:relaxed": {
      title: "上装窄，下装宽",
      action: "上装线条干净或偏贴身时，下装使用更宽松的版型。重点从上半身转到下半身。",
    },
    "relaxed:relaxed": {
      title: "上装宽，下装也宽",
      action: "上下都有体量时，使用鞋、长短关系或一个明确亮点固定视觉重心。",
    },
    "clean:clean": {
      title: "上装窄，下装也窄",
      action: "上下线条都干净时，把设计亮点放在外衣、鞋或配饰其中一处。",
    },
  };
  return [...groups.values()]
    .filter((entry) => entry.cases.length >= 2)
    .map((entry) => {
      const entryCopy = copy[`${entry.topShape}:${entry.bottomShape}`];
      const matchIds = unique(entry.cases.map((outfit) => outfit.matchId));
      return {
        id: idFor("silhouette-rule", entry.topShape, entry.bottomShape),
        ...entryCopy,
        boundary: `这来自 ${matchIds.length} 套已记录搭配。它描述的是你已经用过的做法，不等于所有场景都该这样穿。`,
        topShape: entry.topShape,
        bottomShape: entry.bottomShape,
        matchIds,
        evidenceIds: unique(entry.evidenceIds),
        confirmedCoverage: entry.cases.reduce((sum, outfit) => sum + outfit.evidenceCoverage, 0) / entry.cases.length,
      };
    })
    .sort((left, right) => right.matchIds.length - left.matchIds.length);
}

function insightLevel(matchIds: string[], anchorIds: string[]): "stable" | "emerging" | "case" {
  // A repeated observation needs three independent outfits and two cores before
  // it can be called stable. Two cases remain an early pattern, never a rule.
  if (matchIds.length >= 3 && unique(anchorIds).length >= 2) return "stable";
  if (matchIds.length >= 2) return "emerging";
  return "case";
}

function buildDesignHighlightInsights(
  cases: OutfitCaseGraph[],
  atoms: SemanticAtom[],
  items: Map<string, LocalItem>,
  claims: TextClaim[],
): DesignHighlightInsight[] {
  const atomsByItem = new Map<string, SemanticAtom[]>();
  atoms.forEach((atom) => atomsByItem.set(atom.itemId, [...(atomsByItem.get(atom.itemId) || []), atom]));
  const insights: DesignHighlightInsight[] = [];
  const distributionCopy: Record<Exclude<OutfitCompositionProfile["designFocus"]["distribution"], "quiet">, { title: string; statement: (count: number) => string }> = {
    core_led: {
      title: "搭配前提：核心外衣优先承载设计亮点",
      statement: (count) => `这遵循你已声明的搭配方法。在 ${count} 套已记录搭配里，核心外衣带有已确认的设计亮点；支持单品自己的细节仍会保留，但不会因为有设计细节就自动抢占整套焦点。`,
    },
    shared: {
      title: "设计亮点分布在多件单品上",
      statement: (count) => `在 ${count} 套已记录搭配里，不止一件单品带有设计亮点。这里保留为“多焦点”用法，需结合具体案例判断是否仍有清楚的主次。`,
    },
    support_led: {
      title: "由支持单品补出设计亮点",
      statement: (count) => `在 ${count} 套已记录搭配里，核心外衣之外的单品承担了可见的设计亮点。它说明焦点不总在外衣上，但只对这些具体案例负责。`,
    },
  };
  (Object.keys(distributionCopy) as Array<keyof typeof distributionCopy>).forEach((distribution) => {
    const support = cases.filter((outfit) => outfit.composition.designFocus.distribution === distribution);
    if (!support.length) return;
    const matchIds = unique(support.map((outfit) => outfit.matchId));
    const itemIds = unique(support.flatMap((outfit) => outfit.composition.designFocus.focusItemIds));
    const evidenceIds = unique(support.flatMap((outfit) => [
      ...outfit.composition.designFocus.focusItemIds.flatMap((itemId) => (atomsByItem.get(itemId) || []).filter((atom) => atom.field === "design_highlight").map((atom) => `e:${atom.id}`)),
      ...outfit.primaryItems.filter((item) => outfit.composition.designFocus.focusItemIds.includes(item.itemId)).map((item) => idFor("e:slot", outfit.matchId, item.slot, item.itemId)),
    ]));
    insights.push({
      id: idFor("design-distribution", distribution),
      title: distributionCopy[distribution].title,
      statement: distributionCopy[distribution].statement(matchIds.length),
      level: distribution === "core_led" ? "premise" : insightLevel(matchIds, support.map((outfit) => outfit.anchorItemId)),
      itemIds,
      matchIds,
      evidenceIds,
      confirmedCoverage: support.reduce((sum, outfit) => sum + outfit.evidenceCoverage, 0) / support.length,
    });
  });

  const itemUsage = new Map<string, { matchIds: string[]; anchorMatchIds: string[]; evidenceIds: string[] }>();
  cases.forEach((outfit) => outfit.composition.designFocus.focusItemIds.forEach((itemId) => {
    const entry = itemUsage.get(itemId) || { matchIds: [], anchorMatchIds: [], evidenceIds: [] };
    entry.matchIds.push(outfit.matchId);
    if (itemId === outfit.anchorItemId) entry.anchorMatchIds.push(outfit.matchId);
    entry.evidenceIds.push(
      ...(atomsByItem.get(itemId) || []).filter((atom) => atom.field === "design_highlight").map((atom) => `e:${atom.id}`),
      ...outfit.primaryItems.filter((item) => item.itemId === itemId).map((item) => idFor("e:slot", outfit.matchId, item.slot, item.itemId)),
      ...claims.filter((claim) => claim.status === "confirmed" && claim.type === "design_appreciation" && (claim.subjectItemIds.includes(itemId) || claim.sourceId === itemId)).map((claim) => `e:${claim.id}`),
    );
    itemUsage.set(itemId, entry);
  }));
  [...itemUsage.entries()]
    .map(([itemId, entry]) => ({ itemId, ...entry, rating: ratingOf(items.get(itemId)) || 0 }))
    .sort((left, right) => right.matchIds.length - left.matchIds.length || right.rating - left.rating)
    .slice(0, 6)
    .forEach((entry) => {
      const highlights = unique((atomsByItem.get(entry.itemId) || []).filter((atom) => atom.field === "design_highlight").map((atom) => atom.value));
      const itemName = items.get(entry.itemId)?.name || entry.itemId;
      insights.push({
        id: idFor("design-item", entry.itemId),
        title: `「${itemName}」的设计亮点如何被使用`,
        statement: `已确认亮点：${highlights.slice(0, 3).join("、") || "待补充"}。它进入 ${unique(entry.matchIds).length} 套 Best Match，其中 ${unique(entry.anchorMatchIds).length} 套作为核心外衣。`,
        // This is an item fact rather than a cross-item rule. Reuse does not
        // turn a watch, bag or outerwear detail into a universal design law.
        level: "case",
        itemIds: [entry.itemId],
        matchIds: unique(entry.matchIds),
        evidenceIds: unique(entry.evidenceIds),
        confirmedCoverage: 1,
      });
    });
  return insights.sort((left, right) => ({ premise: 4, stable: 3, emerging: 2, case: 1 }[right.level] - ({ premise: 4, stable: 3, emerging: 2, case: 1 }[left.level]) || right.matchIds.length - left.matchIds.length));
}

function buildColorInsights(cases: OutfitCaseGraph[], colors: PerceptualColor[], items: Map<string, LocalItem>): ColorInsight[] {
  const insights: ColorInsight[] = [];
  const colorByItem = new Map<string, PerceptualColor[]>();
  colors.forEach((color) => colorByItem.set(color.itemId, [...(colorByItem.get(color.itemId) || []), color]));
  const leadColors = (itemColors: PerceptualColor[]) => (["dominant", "secondary", "accent"] as LocalColor["role"][])
    .map((role) => itemColors.filter((color) => color.role === role).sort((left, right) => right.areaRatio - left.areaRatio)[0])
    .filter((color): color is PerceptualColor => Boolean(color));
  const leadColor = (itemColors: PerceptualColor[]) => leadColors(itemColors)[0] || itemColors.sort((left, right) => right.areaRatio - left.areaRatio)[0];
  const families = new Map<ColorFamily, { itemIds: string[]; dominant: number; secondary: number; accent: number; evidenceIds: string[] }>();
  [...colorByItem.values()].flatMap(leadColors).forEach((color) => {
    const family = colorFamily(color);
    const entry = families.get(family) || { itemIds: [], dominant: 0, secondary: 0, accent: 0, evidenceIds: [] };
    entry.itemIds.push(color.itemId);
    entry[color.role] += 1;
    entry.evidenceIds.push(colorEvidenceId(color));
    families.set(family, entry);
  });
  [...families.entries()]
    .map(([family, entry]) => {
      const itemIds = unique(entry.itemIds);
      const ratings = itemIds.map((itemId) => ratingOf(items.get(itemId))).filter((rating): rating is number => rating !== null);
      return { family, ...entry, itemIds, averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null };
    })
    .sort((left, right) => right.itemIds.length - left.itemIds.length || (right.averageRating || 0) - (left.averageRating || 0))
    .slice(0, 7)
    .forEach((entry) => {
      const roles = [entry.dominant ? `主色 ${entry.dominant}` : "", entry.secondary ? `辅色 ${entry.secondary}` : "", entry.accent ? `点缀色 ${entry.accent}` : ""].filter(Boolean).join("、");
      insights.push({
        id: idFor("color-family", entry.family),
        kind: "wardrobe_preference",
        title: `${colorFamilyLabel(entry.family)}在衣橱中的位置`,
        statement: `它出现在 ${entry.itemIds.length} 件已确认单品中（${roles || "颜色角色待补充"}）${entry.averageRating === null ? "。" : `，这些单品的平均评分为 ${entry.averageRating.toFixed(1)}/10。`} 这描述的是你已选择并保留的色彩，不把出现次数直接当作偏好结论。`,
        level: entry.itemIds.length >= 3 ? "stable" : entry.itemIds.length >= 2 ? "emerging" : "case",
        itemIds: entry.itemIds,
        matchIds: [],
        evidenceIds: unique(entry.evidenceIds),
        confirmedCoverage: 1,
      });
    });

  const outfitPairs = new Map<string, { anchorFamily: ColorFamily; supportFamily: ColorFamily; slots: string[]; matchIds: string[]; anchorIds: string[]; itemIds: string[]; evidenceIds: string[] }>();
  cases.forEach((outfit) => {
    const anchorColor = leadColor(colorByItem.get(outfit.anchorItemId) || []);
    if (!anchorColor) return;
    const seen = new Set<string>();
    // Pairing insight is directional: core outerwear → lower half / footwear.
    // Accessories are deliberately excluded here because their recurrence can
    // create a large number of technically true but stylistically empty pairs.
    outfit.primaryItems.filter((item) => item.slot === "bottoms" || item.slot === "shoes").forEach((support) => {
      const supportColor = leadColor(colorByItem.get(support.itemId) || []);
      if (!supportColor) return;
      const anchorFamily = colorFamily(anchorColor);
      const supportFamily = colorFamily(supportColor);
      const key = `${anchorFamily}>${supportFamily}@${support.slot}`;
      if (seen.has(key)) return;
      seen.add(key);
      const entry = outfitPairs.get(key) || { anchorFamily, supportFamily, slots: [], matchIds: [], anchorIds: [], itemIds: [], evidenceIds: [] };
      entry.matchIds.push(outfit.matchId);
      entry.anchorIds.push(outfit.anchorItemId);
      entry.slots.push(support.slot);
      entry.itemIds.push(outfit.anchorItemId, support.itemId);
      entry.evidenceIds.push(colorEvidenceId(anchorColor), colorEvidenceId(supportColor));
      outfitPairs.set(key, entry);
    });
  });
  [...outfitPairs.values()]
    .map((entry) => ({ ...entry, slots: unique(entry.slots), matchIds: unique(entry.matchIds), anchorIds: unique(entry.anchorIds), itemIds: unique(entry.itemIds), evidenceIds: unique(entry.evidenceIds) }))
    .filter((entry) => entry.matchIds.length >= 2)
    .sort((left, right) => {
      const chromatic = (family: ColorFamily) => !["黑", "白", "灰", "米"].includes(family);
      return (Number(chromatic(right.anchorFamily) || chromatic(right.supportFamily)) - Number(chromatic(left.anchorFamily) || chromatic(left.supportFamily))) * 3 || right.matchIds.length - left.matchIds.length;
    })
    .slice(0, 7)
    .forEach((entry) => {
      const supportLabel = entry.slots.includes("bottoms") && entry.slots.includes("shoes") ? "下装或鞋履" : entry.slots.includes("bottoms") ? "下装" : "鞋履";
      insights.push({
        id: idFor("color-pair", entry.anchorFamily, entry.supportFamily, entry.slots.join("-")),
        kind: "outfit_pairing",
        title: `核心${colorFamilyLabel(entry.anchorFamily)}配${supportLabel}${colorFamilyLabel(entry.supportFamily)}`,
        statement: `在 ${entry.matchIds.length} 套 Best Match 中，核心外衣的${colorFamilyLabel(entry.anchorFamily)}与${supportLabel}的${colorFamilyLabel(entry.supportFamily)}形成定向搭配，覆盖 ${entry.anchorIds.length} 件不同核心外衣。${entry.matchIds.length >= 3 && entry.anchorIds.length >= 2 ? "它可以作为稳定配色模式继续观察。" : "目前只算初步模式，不能外推为通用公式。"}`,
        level: insightLevel(entry.matchIds, entry.anchorIds),
        itemIds: entry.itemIds,
        matchIds: entry.matchIds,
        evidenceIds: entry.evidenceIds,
        confirmedCoverage: 1,
      });
    });

  snapshotItemPaletteInsights: for (const [itemId, itemColors] of colorByItem.entries()) {
    const distinct = unique(itemColors.map(colorFamily));
    const item = items.get(itemId);
    const rating = ratingOf(item);
    if (distinct.length < 2 || (rating || 0) < 8) continue;
    const roles = itemColors.map((color) => `${color.role === "dominant" ? "主色" : color.role === "secondary" ? "辅色" : "点缀色"}${colorFamilyLabel(colorFamily(color))}`).join("、");
    insights.push({
      id: idFor("item-palette", itemId),
      kind: "item_palette",
      title: `「${item?.name || itemId}」的单品配色`,
      statement: `你给这件单品 ${rating}/10 分。它内部的颜色结构是：${roles}。这是你已认可的单品配色样本，不等同于它与所有单品都适配。`,
      level: "case",
      itemIds: [itemId],
      matchIds: [],
      evidenceIds: itemColors.map(colorEvidenceId),
      confirmedCoverage: 1,
    });
    if (insights.filter((insight) => insight.kind === "item_palette").length >= 6) break snapshotItemPaletteInsights;
  }
  return insights;
}

function buildManifest(snapshot: LocalSnapshot, sourceSha256?: string, sourceFile?: string): SourceSnapshotManifest {
  const matches = normalizeMatches(snapshot.bestMatches);
  const variantEdges = matches.flatMap((match) => match.slots.flatMap((slot) => slot.variants.map((variant) => ({ matchId: match.id, slot: slot.slot, from: slot.primary, to: variant }))));
  const pairCounts = new Map<string, number>();
  variantEdges.forEach((edge) => pairCounts.set(`${edge.from}→${edge.to}`, (pairCounts.get(`${edge.from}→${edge.to}`) || 0) + 1));
  const rawEmptyByMatch = new Map<string, number>();
  snapshot.bestMatches.forEach((match) => Object.values(match.items || {}).forEach((entries) => (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (!entry || typeof entry === "string") return;
    if (!Array.isArray(entry.variants)) rawEmptyByMatch.set(match.id, (rawEmptyByMatch.get(match.id) || 0) + 1);
    else entry.variants.forEach((variant) => { if (!stableText(variant)) rawEmptyByMatch.set(match.id, (rawEmptyByMatch.get(match.id) || 0) + 1); });
  })));
  const itemIds = new Set(snapshot.wardrobeItems.map((item) => item.id));
  const missingRefs = matches.flatMap((match) => match.slots.flatMap((slot) => [slot.primary, ...slot.variants].filter((id) => !itemIds.has(id)).map(() => match.id)));
  const issues: DataQualityIssue[] = [];
  const emptyCount = [...rawEmptyByMatch.values()].reduce((sum, count) => sum + count, 0);
  if (emptyCount) issues.push({ code: "empty_variant", count: emptyCount, sourceIds: [...rawEmptyByMatch.keys()], message: "空字符串变体已从派生关系图过滤，原始快照保持不变。" });
  const missingYears = snapshot.wardrobeItems.filter((item) => item.purchaseYear === null || item.purchaseYear === undefined || String(item.purchaseYear).trim() === "").map((item) => item.id);
  if (missingYears.length) issues.push({ code: "missing_year", count: missingYears.length, sourceIds: missingYears, message: "缺失购买年份保持未知，不进入购入审美演变计算。" });
  if (missingRefs.length) issues.push({ code: "missing_reference", count: missingRefs.length, sourceIds: unique(missingRefs), message: "存在无法对应到单品的搭配引用。" });
  const unconfirmed = snapshot.visionAnalyses.filter((analysis) => analysis.status !== "confirmed").map((analysis) => analysis.itemId);
  if (unconfirmed.length) issues.push({ code: "unconfirmed_vision", count: unconfirmed.length, sourceIds: unconfirmed, message: "未确认视觉记录只能以 proposed 权重参与探索。" });
  return {
    sourceFile,
    sourceSha256: sourceSha256 || snapshotFingerprint(snapshot),
    generatedAt: new Date().toISOString(),
    schemaVersion: snapshot.schemaVersion || AESTHETIC_SCHEMA_VERSION,
    counts: { items: snapshot.wardrobeItems.length, analyses: snapshot.visionAnalyses.length, confirmedAnalyses: snapshot.visionAnalyses.filter((analysis) => analysis.status === "confirmed").length, matches: snapshot.bestMatches.length, validVariantEdges: variantEdges.length, uniqueSubstitutionPairs: pairCounts.size, repeatedSubstitutionPairs: [...pairCounts.values()].filter((count) => count > 1).length },
    issues,
  };
}

export function buildAestheticAnalysisV3(
  snapshot: LocalSnapshot,
  options: {
    sourceSha256?: string;
    sourceFile?: string;
    bodyProfileText?: string;
    calibrations?: OutfitCalibration[];
    textClaims?: TextClaim[];
    manualFeedback?: ManualFeedback[];
    generatedAt?: string;
  } = {},
): AnalysisRun {
  const matches = normalizeMatches(snapshot.bestMatches);
  const itemsById = new Map(snapshot.wardrobeItems.map((item) => [item.id, item]));
  const atoms = snapshot.visionAnalyses.flatMap(atomsFromAnalysis);
  const colors = snapshot.visionAnalyses.flatMap(colorsFromAnalysis);
  const deterministicClaims = extractDeterministicTextClaims(snapshot);
  const feedback = options.manualFeedback || [];
  const manualClaims: TextClaim[] = feedback.filter((entry) => Boolean(entry.note?.trim())).map((entry) => ({
    id: `claim:manual:${entry.id}`,
    sourceType: "manual",
    sourceId: entry.targetId,
    sourceHash: fnv1a(entry.note || ""),
    quote: entry.note!.trim(),
    type: "constraint",
    subjectItemIds: entry.targetType === "potential" ? [entry.targetId] : [],
    confidence: 1,
    status: "candidate",
    extractor: "user",
    modelVersion: AESTHETIC_ENGINE_VERSION,
    promptVersion: TEXT_PROMPT_VERSION,
  }));
  const claims = validateTextClaims(snapshot, [...deterministicClaims, ...(options.textClaims || []), ...manualClaims]).filter((claim, index, all) => all.findIndex((other) => other.sourceType === claim.sourceType && other.sourceId === claim.sourceId && other.quote === claim.quote && other.type === claim.type) === index);
  const calibrations = matches.map((match) => options.calibrations?.find((entry) => entry.matchId === match.id) || defaultCalibration(match));
  const evidence = evidenceForInputs(snapshot.wardrobeItems, snapshot.visionAnalyses, atoms, colors, matches, claims, calibrations);
  const outfitCases = buildOutfitCases(matches, itemsById, atoms, colors, claims, calibrations);
  const substitutions = applyHumanDecisionsToSubstitutions(substitutionContracts(outfitCases, atoms, colors, evidence), feedback);
  const validation = validationReport(outfitCases, snapshot.wardrobeItems, atoms, substitutions);
  const reviewQuestions = buildReviewQuestions(outfitCases, substitutions, claims, options.bodyProfileText || "");
  const principles = buildPrinciples(outfitCases, validation, reviewQuestions);
  const potentials = buildPotentials(snapshot.wardrobeItems, outfitCases, evidence, feedback);
  const opportunities = buildCombinationOpportunities(snapshot.wardrobeItems, outfitCases, atoms, colors, feedback);
  const silhouetteRules = buildSilhouettePairingRules(outfitCases, atoms);
  const designHighlights = buildDesignHighlightInsights(outfitCases, atoms, itemsById, claims);
  const colorInsights = buildColorInsights(outfitCases, colors, itemsById);
  const generatedAt = options.generatedAt || new Date().toISOString();
  const manifest = buildManifest(snapshot, options.sourceSha256, options.sourceFile);
  manifest.generatedAt = generatedAt;
  return {
    id: idFor("run", generatedAt, manifest.sourceSha256.slice(0, 16), AESTHETIC_ENGINE_VERSION),
    inputSnapshotHash: manifest.sourceSha256,
    engineVersion: AESTHETIC_ENGINE_VERSION,
    promptVersion: TEXT_PROMPT_VERSION,
    conceptGraphVersion: CONCEPT_GRAPH_VERSION,
    generatedAt,
    bodyProfileText: options.bodyProfileText || "",
    manifest,
    atoms,
    colors,
    conceptRelations,
    textClaims: claims,
    calibrations,
    outfitCases,
    substitutions,
    silhouetteRules,
    designHighlights,
    colorInsights,
    principles,
    reviewQuestions,
    potentials,
    opportunities,
    manualFeedback: feedback,
    evidence,
    validation,
  };
}

function ruleValidationFor(decisions: DecisionMechanism[], validation: ValidationReport): RuleValidation {
  const slots = unique(decisions.flatMap((decision) => decision.slots).filter((slot) => slot !== "outfit"));
  const results = validation.slots.filter((result) => slots.includes(result.slot));
  if (!results.length) return { scope: "not_applicable", slots, cases: 0, engineTop3: 0, baselineTop3: 0, passed: false, note: "这条规则目前没有可独立复现的槽位，保留案例和文字证据，不借用全局恢复率。" };
  const cases = results.reduce((sum, result) => sum + result.cases, 0);
  const engineTop3 = results.reduce((sum, result) => sum + result.engineTop3, 0);
  const baselineTop3 = results.reduce((sum, result) => sum + result.baselineTop3, 0);
  const passed = engineTop3 > baselineTop3;
  return {
    scope: "affected_slots",
    slots,
    cases,
    engineTop3,
    baselineTop3,
    passed,
    note: passed
      ? `在 ${slots.join("、")} 槽位的留出恢复中优于高频基线。`
      : `在 ${slots.join("、")} 槽位的留出恢复尚未优于高频基线；不以其它槽位替它背书。`,
  };
}

function reconnectPrinciples(
  principles: AestheticPrinciple[],
  cases: OutfitCaseGraph[],
  validation: ValidationReport,
): AestheticPrinciple[] {
  const decisions = cases.flatMap((outfit) => outfit.decisionMechanisms);
  return principles.map((principle) => {
    const linked = decisions.filter((decision) => decision.ruleId === principle.id && principle.supportMatchIds.includes(decision.caseId));
    const reconnectedEvidenceIds = unique(linked.flatMap((decision) => decision.evidenceIds));
    const coveredCases = new Set(linked.map((decision) => decision.caseId));
    const reconnectionCoverage = principle.supportMatchIds.length ? coveredCases.size / principle.supportMatchIds.length : 0;
    const ruleValidation = ruleValidationFor(linked, validation);
    return {
      ...principle,
      decisionMechanismIds: linked.map((decision) => decision.id),
      reconnectedEvidenceIds,
      reconnectionCoverage,
      reconnectionStatus: !linked.length ? "pending" : ruleValidation.scope === "affected_slots" && !ruleValidation.passed ? "review" : "reconnected",
      ruleValidation,
      evidenceIds: unique([...principle.evidenceIds, ...reconnectedEvidenceIds]),
      holdoutSupport: ruleValidation.passed,
      supportNote: `${principle.supportNote} ${ruleValidation.note}`,
    };
  });
}

export type V4AnalysisOptions = Parameters<typeof buildAestheticAnalysisV3>[1] & {
  principleBaselines?: AestheticPrinciple[];
  decisionBriefs?: OutfitDecisionBrief[];
  wearOutcomes?: WearOutcome[];
};

export function buildAestheticAnalysisV4(
  snapshot: LocalSnapshot,
  options: V4AnalysisOptions = {},
): AnalysisRun {
  const legacy = buildAestheticAnalysisV3(snapshot, options);
  const capturedAt = legacy.generatedAt;
  const baselinePrinciples = options.principleBaselines?.length ? options.principleBaselines : legacy.principles;
  const principleBaselines = baselinePrinciples.map((principle) => ({
    id: `baseline:${principle.id}`,
    principle,
    capturedAt,
    sourceEngineVersion: options.principleBaselines?.length ? "wearlog-aesthetic-v3.5.0" : legacy.engineVersion,
  }));
  const baselineById = new Map(baselinePrinciples.map((principle) => [principle.id, principle]));
  const principles = [...legacy.principles.map((principle) => baselineById.get(principle.id) || principle)];
  baselinePrinciples.forEach((principle) => {
    if (!principles.some((entry) => entry.id === principle.id)) principles.push(principle);
  });
  const decisionBriefs = (options.decisionBriefs || []).filter((brief) => legacy.outfitCases.some((outfit) => outfit.matchId === brief.matchId));
  const briefByMatch = new Map(decisionBriefs.map((brief) => [brief.matchId, brief]));
  const outfitCases = legacy.outfitCases.map((outfit) => ({ ...outfit, decisionBrief: briefByMatch.get(outfit.matchId) }));
  const briefEvidence: EvidenceRecord[] = decisionBriefs.map((brief) => ({
    id: `e:brief:${brief.matchId}`,
    kind: "decision_brief",
    sourceId: brief.matchId,
    label: `${brief.source === "kimi" ? "Kimi 搭配意图" : "Victor 的搭配说明"} · ${brief.confirmation === "user_authorized_auto" ? "按授权自动确认" : brief.confirmed ? "已确认" : "草稿"}`,
    detail: [brief.focus && `突出：${brief.focus}`, brief.problem && `处理：${brief.problem}`, brief.outcome && `结果：${brief.outcome}`].filter(Boolean).join("；"),
    status: brief.confirmed ? "confirmed" : "derived",
    weight: brief.confirmed ? 1 : 0.55,
  }));
  const wearOutcomes = options.wearOutcomes || [];
  const outcomeEvidence: EvidenceRecord[] = wearOutcomes.map((outcome) => ({
    id: `e:wear:${outcome.id}`,
    kind: "wear_outcome",
    sourceId: outcome.opportunityId,
    label: `试后反馈 · ${outcome.state}`,
    detail: outcome.reason,
    status: outcome.state === "accepted" || outcome.state === "not_worn" ? "derived" : "confirmed",
    weight: outcome.state === "accepted" || outcome.state === "not_worn" ? 0.55 : 1,
  }));
  const reconnectedPrinciples = reconnectPrinciples(principles, outfitCases, legacy.validation);
  return {
    ...legacy,
    id: idFor("run", legacy.generatedAt, legacy.manifest.sourceSha256.slice(0, 16), AESTHETIC_V4_ENGINE_VERSION),
    engineVersion: AESTHETIC_V4_ENGINE_VERSION,
    principles: reconnectedPrinciples,
    principleBaselines,
    outfitCases,
    decisionBriefs,
    wearOutcomes,
    evidence: [...legacy.evidence, ...briefEvidence, ...outcomeEvidence],
  };
}

export function buildKimiDecisionBriefRequest(run: AnalysisRun, matchId: string): KimiDecisionBriefRequest | null {
  const outfit = run.outfitCases.find((entry) => entry.matchId === matchId);
  if (!outfit) return null;
  const itemIds = new Set(outfit.primaryItems.map((item) => item.itemId));
  const toItem = (item: OutfitCaseGraph["primaryItems"][number]): KimiDecisionBriefItem => {
    const fields = new Map<VisionField, string[]>();
    run.atoms.filter((atom) => atom.itemId === item.itemId && atom.evidenceStatus === "confirmed").forEach((atom) => {
      fields.set(atom.field, unique([...(fields.get(atom.field) || []), atom.value]));
    });
    return {
      itemId: item.itemId,
      itemName: item.itemName,
      slot: item.slot,
      confirmedFields: [...fields.entries()].map(([field, values]) => ({ field, values })),
      colors: run.colors.filter((color) => color.itemId === item.itemId).map((color) => ({ role: color.role, hex: color.hex, family: colorFamily(color) })),
    };
  };
  const items = outfit.primaryItems.map(toItem);
  const anchor = items.find((item) => item.itemId === outfit.anchorItemId);
  if (!anchor) return null;
  return {
    matchId: outfit.matchId,
    outfitName: outfit.name,
    story: outfit.story,
    anchor,
    items,
    confirmedTextEvidence: run.textClaims
      .filter((claim) => claim.sourceType === "best_match" && claim.sourceId === outfit.matchId && claim.status === "confirmed")
      .map((claim) => ({ quote: claim.quote, type: claim.type, operation: claim.operation, effect: claim.effect })),
    decisionMechanisms: outfit.decisionMechanisms
      .filter((mechanism) => mechanism.role !== "structural" && mechanism.status !== "pending")
      .slice(0, 3)
      .map(({ operation, role, condition, action, effect }) => ({ operation, role, condition, action, effect })),
  };
}

export function textExtractionRecords(snapshot: LocalSnapshot, scope: TextExtractionScope = "best_match"): TextExtractionRecord[] {
  if (scope === "item") return snapshot.wardrobeItems.filter((item) => stableText(item.story)).map((item) => ({ sourceType: "item", sourceId: item.id, text: stableText(item.story) }));
  return snapshot.bestMatches.filter((match) => stableText(match.story)).map((match) => ({ sourceType: "best_match", sourceId: match.id, text: stableText(match.story) }));
}

export function textTransmissionPreview(snapshot: LocalSnapshot, scope: TextExtractionScope = "best_match") {
  const records = textExtractionRecords(snapshot, scope);
  const itemStories = scope === "item" ? records : [];
  const matchStories = scope === "best_match" ? records : [];
  const characters = records.reduce((sum, record) => sum + record.text.length, 0);
  return {
    itemStoryCount: itemStories.length,
    matchStoryCount: matchStories.length,
    characters,
    scope: scope === "best_match" ? "本轮只发送 Best Match 的文字说明；不发送图片、评分、单品信息或完整衣橱。" : "本轮只发送单品故事；不发送图片、评分、单品信息或完整衣橱。",
  };
}

export async function probeKimiStructuredOutput() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  const response = await fetch("/api/local/aesthetic/text-claims/capability", { method: "POST", signal: controller.signal }).finally(() => window.clearTimeout(timeout));
  const payload = await response.json().catch(() => ({})) as { structuredOutput?: boolean; semanticProbe?: boolean; rawSummary?: string };
  return { structuredOutput: Boolean(response.ok && payload.structuredOutput), passed: Boolean(response.ok && payload.semanticProbe), detail: payload.rawSummary };
}

export async function requestKimiTextClaims(snapshot: LocalSnapshot, records: TextExtractionRecord[], repairContent?: string, structuredOutput = false): Promise<{ claims: TextClaim[]; modelVersion: string; structuredOutput: boolean }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  const response = await fetch("/api/local/aesthetic/text-claims", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      records,
      repairContent,
      structuredOutput,
      promptVersion: TEXT_PROMPT_VERSION,
    }),
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeout));
  const payload = await response.json().catch(() => ({})) as { error?: string; rawResponse?: string; claims?: TextClaim[]; modelVersion?: string; structuredOutput?: boolean };
  if (!response.ok) {
    const error = new Error(payload.error || `文本意图提取失败（${response.status}）`);
    Object.assign(error, { rawResponse: payload.rawResponse });
    throw error;
  }
  return { claims: validateTextClaims(snapshot, payload.claims || []), modelVersion: payload.modelVersion || "unknown", structuredOutput: Boolean(payload.structuredOutput) };
}

export async function requestKimiDecisionBrief(request: KimiDecisionBriefRequest): Promise<OutfitDecisionBrief> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), KIMI_DECISION_BRIEF_TIMEOUT_MS);
  const isDevelopment = Boolean(import.meta.env?.DEV);
  let authorization = '';
  if (!isDevelopment) {
    const { supabase } = await import('./supabase');
    const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : '';
    authorization = token ? `Bearer ${token}` : '';
  }
  const response = await fetch(isDevelopment ? "/api/local/aesthetic/decision-brief" : "/api/aesthetic/decision-brief", {
    method: "POST",
    headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) },
    body: JSON.stringify({ request, promptVersion: DECISION_BRIEF_PROMPT_VERSION }),
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeout));
  const payload = await response.json().catch(() => ({})) as { error?: string; brief?: Pick<OutfitDecisionBrief, "focus" | "problem" | "outcome">; modelVersion?: string; promptVersion?: string };
  if (!response.ok || !payload.brief) throw new Error(payload.error || `Kimi 搭配意图起草失败（${response.status}）`);
  return {
    matchId: request.matchId,
    focus: String(payload.brief.focus || "").trim(),
    problem: String(payload.brief.problem || "").trim(),
    outcome: String(payload.brief.outcome || "").trim(),
    source: "kimi",
    modelVersion: payload.modelVersion || "kimi-for-coding",
    promptVersion: payload.promptVersion || DECISION_BRIEF_PROMPT_VERSION,
    confirmed: false,
    updatedAt: new Date().toISOString(),
  };
}

export async function persistAnalysisRun(snapshot: LocalSnapshot, run: AnalysisRun) {
  const response = await fetch("/api/local/aesthetic/versions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ snapshot, run }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; sourceSha256?: string; snapshotFile?: string; runFile?: string; generatedAt?: string; run?: AnalysisRun };
  if (!response.ok) throw new Error(payload.error || `本地版本写入失败（${response.status}）`);
  return payload;
}
