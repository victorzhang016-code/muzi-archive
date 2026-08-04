import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAestheticAnalysisV3,
  buildAestheticAnalysisV4,
  buildKimiDecisionBriefRequest,
  KIMI_DECISION_BRIEF_TIMEOUT_MS,
  authorizeKimiDecisionBrief,
  planKimiDecisionBriefAutomation,
  deltaE76,
  extractDeterministicTextClaims,
  rgbToLab,
  rgbToOklch,
  validateTextClaims,
} from "../src/lib/aestheticAnalysisV3";
import { quickOutfitOptions } from "../src/lib/aestheticProduct";

const payload = (style: string, color: [number, number, number]) => ({
  silhouetteTags: [{ value: "短款，宽松", confidence: 1, evidence: "人工", source: "user" as const }],
  materialTags: [{ value: "硬挺, 机能面料", confidence: 1, evidence: "人工", source: "user" as const }],
  patternTags: [],
  styleTags: [{ value: style, confidence: 1, evidence: "人工", source: "user" as const }],
  designHighlights: [{ value: "结构口袋", confidence: 1, evidence: "人工", source: "user" as const }],
  visualWeight: { value: "中等", confidence: 1, evidence: "人工", source: "user" as const },
  formality: { value: "日常", confidence: 1, evidence: "人工", source: "user" as const },
  dominantColors: [{ rgb: color, hex: "#000000", role: "dominant" as const, areaRatio: 1, region: "garment" as const, confidence: 1, source: "user" as const }],
});

const synthetic = {
  schemaVersion: "test-v1",
  exportedAt: "2026-07-22T00:00:00.000Z",
  wardrobeItems: [
    { id: "coat-a", name: "核心外套", category: "上装", purchaseYear: 2025, rating: 10, story: "我喜欢它的结构口袋，因为它有清楚的设计焦点。" },
    { id: "pants-a", name: "承接裤", category: "下装", purchaseYear: 2025, rating: 5, story: "它很基础，但穿起来舒服。" },
    { id: "pants-b", name: "替换裤", category: "下装", purchaseYear: 2026, rating: 8, story: "颜色更亮。" },
    { id: "shoe-a", name: "重鞋", category: "鞋", purchaseYear: 2025, rating: 7, story: "用来压住重心。" },
  ],
  bestMatches: [
    { id: "m1", name: "案例一", story: "围绕核心外套，用重鞋压住重心。", items: { tops: [{ primary: "coat-a" }], bottoms: [{ primary: "pants-a", variants: ["", "pants-b", "pants-b"] }], shoes: [{ primary: "shoe-a" }] } },
    { id: "m2", name: "案例二", story: "裤子也可以换成替换裤。", items: { tops: [{ primary: "coat-a" }], bottoms: [{ primary: "pants-a", variants: ["pants-b"] }], shoes: [{ primary: "shoe-a" }] } },
  ],
  visionAnalyses: [
    { id: "a1", itemId: "coat-a", status: "confirmed" as const, modelVersion: "manual", payload: payload("机能，设计感", [30, 30, 35]), updatedAt: "2026-07-22" },
    { id: "a2", itemId: "pants-a", status: "confirmed" as const, modelVersion: "manual", payload: payload("基础款", [25, 25, 25]), updatedAt: "2026-07-22" },
    { id: "a3", itemId: "pants-b", status: "proposed" as const, modelVersion: "manual", payload: payload("机能", [180, 180, 185]), updatedAt: "2026-07-22" },
    { id: "a4", itemId: "shoe-a", status: "confirmed" as const, modelVersion: "manual", payload: payload("厚重", [15, 15, 18]), updatedAt: "2026-07-22" },
  ],
};

test("atomizes Chinese and English commas while retaining parent groups", () => {
  const run = buildAestheticAnalysisV3(structuredClone(synthetic));
  const coatSilhouette = run.atoms.filter((atom) => atom.itemId === "coat-a" && atom.field === "silhouette");
  assert.deepEqual(coatSilhouette.map((atom) => atom.value), ["短款", "宽松"]);
  assert.ok(coatSilhouette.every((atom) => atom.parentValue === "短款，宽松"));
  assert.equal(run.atoms.find((atom) => atom.itemId === "pants-b")?.weight, 0.55);
});

test("filters blank and duplicate variants without mutating source", () => {
  const source = structuredClone(synthetic);
  const before = JSON.stringify(source);
  const run = buildAestheticAnalysisV3(source);
  assert.equal(run.manifest.counts.validVariantEdges, 2);
  assert.equal(run.manifest.counts.uniqueSubstitutionPairs, 1);
  assert.equal(run.substitutions[0].contextMatchIds.length, 2);
  assert.match(run.substitutions[0].boundary, /核心|上下文/);
  assert.equal(JSON.stringify(source), before);
});

test("keeps RGB and produces perceptual Lab and OKLCH values", () => {
  const blackLab = rgbToLab([0, 0, 0]);
  const whiteLab = rgbToLab([255, 255, 255]);
  const redOklch = rgbToOklch([255, 0, 0]);
  assert.ok(deltaE76(blackLab, whiteLab) > 90);
  assert.ok(redOklch[0] > 0 && redOklch[1] > 0);
});

test("accepts only exact text quote substrings", () => {
  const claims = extractDeterministicTextClaims(synthetic);
  assert.ok(claims.some((claim) => claim.quote.includes("喜欢")));
  const invalid = { ...claims[0], id: "invalid", quote: "原文中不存在的改写" };
  assert.equal(validateTextClaims(synthetic, [...claims, invalid]).some((claim) => claim.id === "invalid"), false);
});

test("keeps high-rated unused items in potential rather than inferring low value", () => {
  const source = structuredClone(synthetic);
  source.wardrobeItems.push({ id: "story-piece", name: "情感单品", category: "配饰", purchaseYear: 2024, rating: 10, story: "这是朋友送的纪念。" });
  source.visionAnalyses.push({ id: "a5", itemId: "story-piece", status: "confirmed", modelVersion: "manual", payload: payload("设计感", [120, 30, 50]), updatedAt: "2026-07-22" });
  const run = buildAestheticAnalysisV3(source);
  assert.equal(run.potentials.find((item) => item.itemId === "story-piece")?.matchCount, 0);
});

test("does not flag a core outerwear or unrelated prose as an underused-item conflict", () => {
  const source = structuredClone(synthetic);
  source.bestMatches = [source.bestMatches[0]];
  const unrelatedClaim = {
    id: "claim:aversion", sourceType: "best_match" as const, sourceId: "m1", sourceHash: "test",
    quote: "围绕核心外套，用重鞋压住重心。", type: "aversion" as const, subjectItemIds: [],
    condition: "", action: "", effect: "", limitation: "不适合雨天", confidence: 1,
    status: "confirmed" as const, extractor: "user" as const, modelVersion: "test", promptVersion: "test",
  };
  const run = buildAestheticAnalysisV3(source, { textClaims: [unrelatedClaim] });
  assert.equal(run.potentials.some((item) => item.itemId === "coat-a"), false);
  assert.equal(run.reviewQuestions.some((question) => question.kind === "text_structure_conflict"), false);
});

test("keeps a rejected new combination as a local counterexample", () => {
  const source = structuredClone(synthetic);
  source.wardrobeItems.push({ id: "pants-c", name: "待试下装", category: "下装", purchaseYear: 2026, rating: 8, story: "还没有和这件外套搭过。" });
  source.visionAnalyses.push({ id: "a7", itemId: "pants-c", status: "confirmed", modelVersion: "manual", payload: payload("机能", [31, 31, 36]), updatedAt: "2026-07-22" });
  const first = buildAestheticAnalysisV3(source);
  const opportunity = first.opportunities.find((item) => item.candidateItemId === "pants-c");
  assert.ok(opportunity);
  const second = buildAestheticAnalysisV3(source, { manualFeedback: [{ id: "feedback:reject", targetType: "opportunity", targetId: opportunity.id, choice: "拒绝", note: "裤脚和这件外套的比例不对。", updatedAt: "2026-07-24" }] });
  assert.equal(second.opportunities.some((item) => item.id === opportunity.id), false);
});

test("keeps two-case mechanisms as early patterns and derives design and colour evidence separately", () => {
  const source = structuredClone(synthetic);
  source.wardrobeItems.push({ id: "bag-a", name: "高频黄包", category: "配饰", purchaseYear: 2025, rating: 6, story: "常用配饰。" });
  source.visionAnalyses.push({ id: "a6", itemId: "bag-a", status: "confirmed", modelVersion: "manual", payload: payload("配饰", [230, 210, 20]), updatedAt: "2026-07-22" });
  source.bestMatches.forEach((match) => { (match.items as Record<string, unknown>).accessories = [{ primary: "bag-a" }]; });
  const run = buildAestheticAnalysisV3(source);
  const twoCase = run.principles.find((principle) => principle.supportMatchIds.length === 2);
  assert.ok(twoCase);
  assert.notEqual(twoCase.kind, "enacted");
  assert.match(twoCase.supportNote, /2 套/);
  assert.ok(run.designHighlights.some((insight) => insight.itemIds.includes("coat-a")));
  assert.ok(run.colorInsights.some((insight) => insight.kind === "wardrobe_preference"));
  assert.equal(run.outfitCases.every((outfit) => outfit.composition.designFocus.distribution === "core_led" && outfit.composition.designFocus.supportDetailItemIds.includes("pants-a")), true);
  assert.equal(run.colorInsights.filter((insight) => insight.kind === "outfit_pairing").some((insight) => insight.itemIds.includes("bag-a")), false);
});

test("migrates existing principles into v4 without losing their wording or cases", () => {
  const source = structuredClone(synthetic);
  const legacy = buildAestheticAnalysisV3(source);
  const migrated = buildAestheticAnalysisV4(source, { principleBaselines: legacy.principles });
  const original = legacy.principles.find((principle) => principle.id === "principle:color_echo");
  const retained = migrated.principles.find((principle) => principle.id === "principle:color_echo");
  assert.ok(original);
  assert.ok(retained);
  assert.equal(retained.title, original.title);
  assert.equal(retained.statement, original.statement);
  assert.deepEqual(retained.supportMatchIds, original.supportMatchIds);
  assert.equal(migrated.principleBaselines.some((baseline) => baseline.principle.id === original.id), true);
});

test("turns each outfit into a bounded decision chain with traceable rule evidence", () => {
  const source = structuredClone(synthetic);
  const run = buildAestheticAnalysisV4(source);
  const decisions = run.outfitCases.flatMap((outfit) => outfit.decisionMechanisms);
  assert.ok(decisions.length > 0);
  assert.ok(decisions.every((decision) => decision.ruleId && decision.caseId && decision.evidenceIds.length > 0));
  assert.ok(run.outfitCases.every((outfit) => outfit.decisionMechanisms.filter((decision) => decision.role === "dominant").length <= 1));
  assert.ok(run.outfitCases.every((outfit) => outfit.decisionMechanisms.filter((decision) => decision.role === "supporting").length <= 2));
  assert.equal(decisions.some((decision) => decision.operation === "color_echo" && decision.role === "dominant"), false);
});

test("reconnects every retained principle to its own decision mechanisms and slot validation", () => {
  const source = structuredClone(synthetic);
  const legacy = buildAestheticAnalysisV3(source);
  const run = buildAestheticAnalysisV4(source, { principleBaselines: legacy.principles });
  const principle = run.principles.find((entry) => entry.id === "principle:color_echo");
  assert.ok(principle);
  assert.ok(principle.decisionMechanismIds.length > 0);
  assert.ok(principle.decisionMechanismIds.every((id) => run.outfitCases.flatMap((outfit) => outfit.decisionMechanisms).some((decision) => decision.id === id && decision.ruleId === principle.id)));
  assert.ok(principle.reconnectedEvidenceIds.length > 0);
  assert.ok(principle.ruleValidation);
  assert.notEqual(principle.ruleValidation?.scope, "global");
});

test("keeps Victor's confirmed outfit brief separate from inferred mechanisms", () => {
  const source = structuredClone(synthetic);
  const run = buildAestheticAnalysisV4(source, {
    decisionBriefs: [{ matchId: "m1", focus: "突出外套的结构口袋", problem: "下半身不能抢焦点", outcome: "重鞋把重心压住了", confirmed: true, updatedAt: "2026-08-03" }],
  });
  const outfit = run.outfitCases.find((entry) => entry.matchId === "m1");
  assert.equal(outfit?.decisionBrief?.focus, "突出外套的结构口袋");
  assert.equal(outfit?.decisionBrief?.confirmed, true);
  assert.equal(outfit?.decisionMechanisms.some((decision) => decision.evidenceIds.includes("e:brief:m1")), false);
  assert.ok(run.evidence.some((evidence) => evidence.id === "e:brief:m1" && evidence.kind === "decision_brief"));
});

test("builds one-outfit K3 briefing input from only the selected outfit's evidence", () => {
  const source = structuredClone(synthetic);
  source.wardrobeItems.push({ id: "private-unrelated", name: "不相关私人物件", category: "配饰", purchaseYear: 2026, rating: 10, story: "这段文字不能传给当前搭配的 Kimi 草案。" });
  source.visionAnalyses.push({ id: "a-private", itemId: "private-unrelated", status: "confirmed", modelVersion: "manual", payload: payload("私密", [1, 2, 3]), updatedAt: "2026-07-22" });
  const run = buildAestheticAnalysisV4(source);
  const request = buildKimiDecisionBriefRequest(run, "m1");
  assert.ok(request);
  assert.equal(request?.matchId, "m1");
  assert.equal(request?.anchor.itemId, "coat-a");
  assert.ok(request?.items.every((item) => ["coat-a", "pants-a", "shoe-a"].includes(item.itemId)));
  assert.equal(JSON.stringify(request).includes("不相关私人物件"), false);
  assert.equal(JSON.stringify(request).includes("rating"), false);
  assert.ok(request?.decisionMechanisms.length);
});

test("keeps an unconfirmed K3 brief as a draft until Victor confirms it", () => {
  const source = structuredClone(synthetic);
  const draft = buildAestheticAnalysisV4(source, {
    decisionBriefs: [{ matchId: "m1", focus: "突出外套的结构口袋", problem: "下半身不能抢焦点", outcome: "重鞋把重心压住了", source: "kimi", modelVersion: "k3", promptVersion: "wearlog-decision-brief-v1", confirmed: false, updatedAt: "2026-08-04" }],
  });
  assert.equal(draft.outfitCases.find((entry) => entry.matchId === "m1")?.decisionBrief?.confirmed, false);
  assert.equal(draft.evidence.find((entry) => entry.id === "e:brief:m1")?.weight, 0.55);
  const confirmed = buildAestheticAnalysisV4(source, {
    decisionBriefs: [{ matchId: "m1", focus: "突出外套的结构口袋", problem: "下半身不能抢焦点", outcome: "重鞋把重心压住了", source: "kimi", modelVersion: "k3", promptVersion: "wearlog-decision-brief-v1", confirmed: true, updatedAt: "2026-08-04" }],
  });
  assert.equal(confirmed.evidence.find((entry) => entry.id === "e:brief:m1")?.weight, 1);
});

test("records Victor's automatic authorization without pretending Kimi wrote user text", () => {
  const brief = authorizeKimiDecisionBrief({
    matchId: "m1", focus: "突出外套的结构口袋", problem: "下半身不能抢焦点", outcome: "重鞋把重心压住了",
    source: "kimi", modelVersion: "k3", promptVersion: "wearlog-decision-brief-v1", confirmed: false, updatedAt: "2026-08-04",
  });
  assert.equal(brief.confirmed, true);
  assert.equal(brief.source, "kimi");
  assert.equal(brief.confirmation, "user_authorized_auto");
});

test("automates only missing Kimi briefs and preserves existing manual intent", () => {
  const source = structuredClone(synthetic);
  const run = buildAestheticAnalysisV4(source);
  const plan = planKimiDecisionBriefAutomation(run, [
    { matchId: "m1", focus: "手写内容", problem: "手写问题", outcome: "手写结果", source: "user", confirmation: "manual", confirmed: true, updatedAt: "2026-08-04" },
    { matchId: "m2", focus: "Kimi 草案", problem: "", outcome: "", source: "kimi", confirmed: false, updatedAt: "2026-08-04" },
  ]);
  assert.deepEqual(plan.generateMatchIds, []);
  assert.deepEqual(plan.autoConfirmMatchIds, ["m2"]);
  const missing = planKimiDecisionBriefAutomation(run, []);
  assert.deepEqual(missing.generateMatchIds.sort(), ["m1", "m2"]);
});

test("gives a single K3 outfit intent request enough time to finish", () => {
  assert.ok(KIMI_DECISION_BRIEF_TIMEOUT_MS >= 60_000);
});

test("keeps a trial outcome as scoped local evidence without fabricating a new rule", () => {
  const source = structuredClone(synthetic);
  const base = buildAestheticAnalysisV4(source);
  const run = buildAestheticAnalysisV4(source, {
    wearOutcomes: [{ id: "wear:trial-1", opportunityId: "trial-1", state: "unsatisfied", reason: "鞋的重量不够", updatedAt: "2026-08-03" }],
  });
  assert.ok(run.evidence.some((evidence) => evidence.id === "e:wear:wear:trial-1" && evidence.kind === "wear_outcome"));
  assert.deepEqual(run.principles.map((principle) => principle.id), base.principles.map((principle) => principle.id));
});

test("quick mode returns only recorded Best Match and contextual variants", () => {
  const stamp = { toDate: () => new Date("2026-08-04T00:00:00.000Z") };
  const items = [
    { id: "coat", name: "外套", category: "上装" },
    { id: "pants", name: "长裤", category: "下装" },
    { id: "shoe-a", name: "鞋 A", category: "鞋子" },
    { id: "shoe-b", name: "鞋 B", category: "鞋子" },
  ].map((item) => ({ ...item, userId: "u", season: "四季", rating: 8, story: "", createdAt: stamp, updatedAt: stamp })) as any;
  const matches = [{
    id: "m1", userId: "u", name: "已确认搭配", allItemIds: ["coat", "pants", "shoe-a", "shoe-b"],
    items: { tops: [{ primary: "coat" }], bottoms: [{ primary: "pants" }], shoes: [{ primary: "shoe-a", variants: ["shoe-b"] }], accessories: [] },
    createdAt: stamp, updatedAt: stamp,
  }] as any;

  const direct = quickOutfitOptions("coat", matches, items);
  assert.equal(direct.length, 1);
  assert.equal(direct[0].kind, "confirmed_match");
  const variant = quickOutfitOptions("shoe-b", matches, items);
  assert.equal(variant.length, 1);
  assert.equal(variant[0].kind, "confirmed_variant");
  assert.equal(variant[0].replacedItem?.id, "shoe-a");
  assert.equal(quickOutfitOptions("missing", matches, items).length, 0);
});
