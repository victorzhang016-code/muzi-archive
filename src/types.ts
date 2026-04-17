import { Timestamp } from 'firebase/firestore';

export type Category = '上装' | '下装' | '鞋子' | '配饰';
export type Season = '春秋' | '春季' | '秋季' | '夏季' | '冬季' | '四季' | '无';
export type PantsLength = '长裤' | '短裤';

export interface WardrobeItem {
  id: string;
  userId: string;
  name: string;
  category: Category;
  season: Season;
  length?: PantsLength;
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

export interface BestMatchItems {
  tops: string[];
  bottoms: string[];
  shoes: string[];
  accessories: string[];
}

export interface BestMatch {
  id: string;
  userId: string;
  items: BestMatchItems;
  sceneTags?: SceneTag[];
  note?: string;
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
