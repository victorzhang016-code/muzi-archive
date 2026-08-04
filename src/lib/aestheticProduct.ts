import type { BestMatch, BestMatchItems, WardrobeItem } from '../types';
import type { VisionAnalysis } from './aestheticVision';
import { buildAestheticAnalysisV4, type AnalysisRun, type ManualFeedback, type OutfitCalibration, type OutfitDecisionBrief, type TextClaim, type WearOutcome } from './aestheticAnalysisV3';
import { normalizeAestheticSnapshot, type LocalSnapshot } from './aestheticContracts';

const STORAGE = {
  body: 'wearlog.local.aesthetic.body-profile.v3',
  calibrations: 'wearlog.local.aesthetic.calibrations.v3',
  claims: 'wearlog.local.aesthetic.text-claims.v3',
  feedback: 'wearlog.local.aesthetic.manual-feedback.v3',
  briefs: 'wearlog.local.aesthetic.decision-briefs.v4',
  outcomes: 'wearlog.local.aesthetic.wear-outcomes.v4',
  run: 'wearlog.local.aesthetic.last-run.v3',
} as const;

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function timestampIso(value: WardrobeItem['updatedAt'] | BestMatch['updatedAt']) {
  try {
    return value?.toDate?.().toISOString?.() || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export function liveAestheticSnapshot(
  items: WardrobeItem[],
  matches: BestMatch[],
  analyses: VisionAnalysis[],
): LocalSnapshot {
  return normalizeAestheticSnapshot({
    schemaVersion: 'wearlog-aesthetic-product-v1',
    exportedAt: new Date().toISOString(),
    wardrobeItems: items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      brand: item.brand,
      season: item.season,
      purchaseYear: item.purchaseYear,
      story: item.story,
      imageUrl: item.imageUrl,
      rating: item.rating,
      length: item.length,
      topType: item.topType,
      accessoryType: item.accessoryType,
      updatedAt: timestampIso(item.updatedAt),
    })),
    bestMatches: matches.map((match) => ({
      id: match.id,
      name: match.name,
      story: match.story,
      sceneTags: match.sceneTags,
      items: match.items,
      allItemIds: match.allItemIds,
      updatedAt: timestampIso(match.updatedAt),
    })),
    visionAnalyses: analyses,
  });
}

export function buildLiveAestheticRun(snapshot: LocalSnapshot): AnalysisRun {
  const previous = readStorage<AnalysisRun | null>(STORAGE.run, null);
  const storedOutcomes = readStorage<WearOutcome[]>(STORAGE.outcomes, []);
  const quickOutcomes: WearOutcome[] = listQuickWearRecords().map((record) => ({
    id: record.id,
    opportunityId: record.matchId,
    state: record.state === 'selected' ? 'accepted' : record.state,
    reason: record.reason,
    updatedAt: record.selectedAt,
  }));
  const outcomeById = new Map(storedOutcomes.map((entry) => [entry.id, entry]));
  quickOutcomes.forEach((entry) => outcomeById.set(entry.id, entry));
  return buildAestheticAnalysisV4(snapshot, {
    bodyProfileText: readStorage(STORAGE.body, ''),
    calibrations: readStorage<OutfitCalibration[]>(STORAGE.calibrations, []),
    textClaims: readStorage<TextClaim[]>(STORAGE.claims, []),
    manualFeedback: readStorage<ManualFeedback[]>(STORAGE.feedback, []),
    decisionBriefs: readStorage<OutfitDecisionBrief[]>(STORAGE.briefs, []),
    wearOutcomes: [...outcomeById.values()],
    principleBaselines: previous?.principleBaselines?.map((entry) => entry.principle) || previous?.principles || [],
  });
}

export function saveDecisionBrief(brief: OutfitDecisionBrief) {
  const current = readStorage<OutfitDecisionBrief[]>(STORAGE.briefs, []);
  const next = [...current.filter((entry) => entry.matchId !== brief.matchId), brief];
  window.localStorage.setItem(STORAGE.briefs, JSON.stringify(next));
  return next;
}

export type QuickOutfitSelection = {
  slot: keyof BestMatchItems;
  index: number;
  item: WardrobeItem;
  replacedItem?: WardrobeItem;
};

export type QuickOutfitOption = {
  id: string;
  sourceMatch: BestMatch;
  anchorItem: WardrobeItem;
  kind: 'confirmed_match' | 'confirmed_variant';
  selections: QuickOutfitSelection[];
  replacedSlot?: keyof BestMatchItems;
  replacedItem?: WardrobeItem;
};

const SLOT_ORDER: Array<keyof BestMatchItems> = ['tops', 'bottoms', 'shoes', 'accessories'];

function selectionsForMatch(match: BestMatch, itemMap: Map<string, WardrobeItem>) {
  return SLOT_ORDER.flatMap((slot) => match.items[slot].map((entry, index) => {
    const item = itemMap.get(entry.primary);
    return item ? { slot, index, item } satisfies QuickOutfitSelection : null;
  }).filter((entry): entry is QuickOutfitSelection => Boolean(entry)));
}

function isComplete(selections: QuickOutfitSelection[]) {
  return selections.some((entry) => entry.slot === 'tops') && selections.some((entry) => entry.slot === 'bottoms');
}

export function quickOutfitOptions(anchorItemId: string, matches: BestMatch[], items: WardrobeItem[]) {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const anchorItem = itemMap.get(anchorItemId);
  if (!anchorItem) return [] as QuickOutfitOption[];
  const options: QuickOutfitOption[] = [];

  for (const match of matches) {
    const primary = selectionsForMatch(match, itemMap);
    if (!isComplete(primary)) continue;
    const primaryHits = primary.filter((entry) => entry.item.id === anchorItemId);
    if (primaryHits.length) {
      options.push({
        id: `${match.id}:${anchorItemId}:primary`,
        sourceMatch: match,
        anchorItem,
        kind: 'confirmed_match',
        selections: primary,
      });
    }

    SLOT_ORDER.forEach((slot) => {
      match.items[slot].forEach((entry, index) => {
        if (!entry.variants?.includes(anchorItemId)) return;
        const replacedItem = itemMap.get(entry.primary);
        const next = primary.map((selection) => selection.slot === slot && selection.index === index
          ? { ...selection, item: anchorItem, replacedItem }
          : selection);
        if (!isComplete(next) || !next.some((selection) => selection.item.id === anchorItemId)) return;
        options.push({
          id: `${match.id}:${anchorItemId}:${slot}:${index}`,
          sourceMatch: match,
          anchorItem,
          kind: 'confirmed_variant',
          selections: next,
          replacedSlot: slot,
          replacedItem,
        });
      });
    });
  }

  const seen = new Set<string>();
  return options.filter((option) => {
    const canonical = option.selections.map((entry) => `${entry.slot}:${entry.index}:${entry.item.id}`).join('|');
    if (seen.has(canonical)) return false;
    seen.add(canonical);
    return true;
  }).sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'confirmed_match' ? -1 : 1;
    const leftTime = left.sourceMatch.updatedAt?.toDate?.().getTime?.() || 0;
    const rightTime = right.sourceMatch.updatedAt?.toDate?.().getTime?.() || 0;
    return rightTime - leftTime || left.id.localeCompare(right.id);
  }).slice(0, 3);
}

export type QuickWearRecord = {
  id: string;
  optionId: string;
  anchorItemId: string;
  matchId: string;
  selectedAt: string;
  state: 'selected' | 'satisfied' | 'unsatisfied' | 'not_worn';
  reason?: string;
};

const QUICK_RECORDS_KEY = 'wearlog.aesthetic.quick-wear.v1';

export function listQuickWearRecords() {
  return readStorage<QuickWearRecord[]>(QUICK_RECORDS_KEY, []);
}

export function saveQuickWearRecord(record: QuickWearRecord) {
  const next = [record, ...listQuickWearRecords().filter((entry) => entry.id !== record.id)].slice(0, 100);
  window.localStorage.setItem(QUICK_RECORDS_KEY, JSON.stringify(next));
  return next;
}
