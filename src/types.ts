import { Timestamp } from 'firebase/firestore';

export type Category = '上装' | '下装' | '鞋子' | '配饰';
export type Season = '春秋' | '春季' | '秋季' | '夏季' | '冬季' | '四季' | '无';

export interface WardrobeItem {
  id: string;
  userId: string;
  name: string;
  category: Category;
  season: Season;
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
