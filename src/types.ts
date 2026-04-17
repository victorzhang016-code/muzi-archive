import { Timestamp } from 'firebase/firestore';

export type Category = '上装' | '下装' | '鞋子' | '配饰';
export type Season = '春秋' | '春季' | '秋季' | '夏季' | '冬季' | '四季' | '无';
export type PantsLength = '长裤' | '短裤' | '裙子';
export type TopType = '短袖' | '长袖' | '衬衫' | '卫衣' | '毛衣' | '针织衫' | '背心' | '夹克' | '外套' | '皮衣' | '风衣' | '大衣' | '羽绒服' | '西服' | '马甲' | '连衣裙' | '吊带';

export const TOP_TYPES: TopType[] = ['短袖', '长袖', '衬衫', '卫衣', '毛衣', '针织衫', '背心', '夹克', '外套', '皮衣', '风衣', '大衣', '羽绒服', '西服', '马甲', '连衣裙', '吊带'];
export const BOTTOM_TYPES: PantsLength[] = ['长裤', '短裤', '裙子'];

export type AccessoryType =
  | '耳环' | '耳钉' | '耳夹'
  | '项链' | '吊坠'
  | '领带' | '领结' | '丝巾' | '围巾'
  | '手链' | '手镯' | '手表'
  | '戒指' | '手套' | '袖扣'
  | '腰带' | '皮带' | '裤链'
  | '脚链'
  | '包包' | '背包' | '钱包' | '钥匙扣'
  | '帽子' | '眼镜' | '墨镜'
  | '发饰' | '发带'
  | '胸针' | '徽章' | '挂件' | '玩偶' | '口罩';

export const ACCESSORY_TYPES: AccessoryType[] = [
  '耳环', '耳钉', '耳夹',
  '项链', '吊坠',
  '领带', '领结', '丝巾', '围巾',
  '手链', '手镯', '手表',
  '戒指', '手套', '袖扣',
  '腰带', '皮带', '裤链',
  '脚链',
  '包包', '背包', '钱包', '钥匙扣',
  '帽子', '眼镜', '墨镜',
  '发饰', '发带',
  '胸针', '徽章', '挂件', '玩偶', '口罩',
];

export interface WardrobeItem {
  id: string;
  userId: string;
  name: string;
  category: Category;
  season: Season;
  length?: PantsLength;
  topType?: TopType;
  accessoryType?: AccessoryType;
  rating: number;
  story: string;
  brand?: string;
  purchaseYear?: number;
  imageUrl?: string;
  orderIndex?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type NewWardrobeItem = Omit<WardrobeItem, 'id' | 'createdAt' | 'updatedAt'>;

// ───────────────────────── Best Match ─────────────────────────

export type SceneTag = '通勤' | '约会' | '正式' | '松弛' | '外出' | '居家';

export const SCENE_TAGS: SceneTag[] = ['通勤', '约会', '正式', '松弛', '外出', '居家'];

export const BEST_MATCH_CAPS = {
  tops: 4,
  bottoms: 2,
  shoes: 2,
  accessories: 5,
} as const;

/**
 * A single slot in a best match — one primary garment, optionally with a list
 * of variant alternatives ("白衬衫，可换成黑衬衫"). Variants are first-class
 * citizens for radiation/discovery: they count as "appearing in" the outfit.
 */
export interface BestMatchSlot {
  primary: string;
  variants?: string[];
}

export interface BestMatchItems {
  tops: BestMatchSlot[];
  bottoms: BestMatchSlot[];
  shoes: BestMatchSlot[];
  accessories: BestMatchSlot[];
}

export interface BestMatch {
  id: string;
  userId: string;
  items: BestMatchItems;
  /** Flattened mirror of every primary + variant id across all slots — enables
   *  array-contains queries for the v2 single-item radiation graph. */
  allItemIds: string[];
  name?: string;
  story?: string;
  sceneTags?: SceneTag[];
  photoBase64?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type NewBestMatch = Omit<BestMatch, 'id' | 'createdAt' | 'updatedAt'>;

export interface AestheticProfile {
  id: string;
  styleTendency: string;
  colorPalette: string[];
  categoryPattern: string;
  exploreSuggestions: string[];
  basedOnCount: number;
  generatedAt: Timestamp;
}
