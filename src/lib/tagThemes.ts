export type TagTheme = {
  texture: string;
  bgColor: string;
  overlayColor: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderEdge: string;
  accentColor: string;
  holeColor: string;
  isLight: boolean;
};

export const TAG_THEMES: TagTheme[] = [
  // 0 — White watercolor paper
  {
    texture: "url('/textures/paper-white.jpg')",
    bgColor: '#F8F6F0',
    overlayColor: 'rgba(248,246,240,0.30)',
    textPrimary: '#1C1C1A',
    textSecondary: '#6B6A65',
    textMuted: 'rgba(107,106,101,0.40)',
    borderEdge: 'rgba(0,0,0,0.10)',
    accentColor: '#C24127',
    holeColor: '#D8D0C0',
    isLight: true,
  },
  // 1 — Washi/hand paper, warm ivory
  {
    texture: "url('/textures/washi.jpg')",
    bgColor: '#F4EFE3',
    overlayColor: 'rgba(244,239,227,0.38)',
    textPrimary: '#2A2117',
    textSecondary: '#7A6E5A',
    textMuted: 'rgba(100,90,70,0.40)',
    borderEdge: 'rgba(0,0,0,0.09)',
    accentColor: '#8B6914',
    holeColor: '#C8C0AE',
    isLight: true,
  },
  // 2 — Dark charcoal
  {
    texture: 'none',
    bgColor: '#242422',
    overlayColor: 'transparent',
    textPrimary: '#EEE9DF',
    textSecondary: 'rgba(238,233,223,0.58)',
    textMuted: 'rgba(238,233,223,0.28)',
    borderEdge: 'rgba(255,255,255,0.07)',
    accentColor: '#E8D5A0',
    holeColor: '#3E3E3A',
    isLight: false,
  },
  // 3 — Crimson fabric
  {
    texture: "url('/textures/crimson-linen.jpg')",
    bgColor: '#62202A',
    overlayColor: 'rgba(62,16,22,0.55)',
    textPrimary: '#F5EDE0',
    textSecondary: 'rgba(245,237,224,0.65)',
    textMuted: 'rgba(245,237,224,0.32)',
    borderEdge: 'rgba(0,0,0,0.22)',
    accentColor: '#E8C97A',
    holeColor: '#3A1018',
    isLight: false,
  },
  // 4 — Grid paper
  {
    texture: "url('/textures/grid-paper.jpg')",
    bgColor: '#F9F8F0',
    overlayColor: 'rgba(249,248,240,0.32)',
    textPrimary: '#1C1C1A',
    textSecondary: '#5A5A50',
    textMuted: 'rgba(90,90,80,0.38)',
    borderEdge: 'rgba(0,0,0,0.08)',
    accentColor: '#3A6B3A',
    holeColor: '#D5D3C8',
    isLight: true,
  },
  // 5 — Deep navy
  {
    texture: 'none',
    bgColor: '#18243E',
    overlayColor: 'transparent',
    textPrimary: '#EEF2F8',
    textSecondary: 'rgba(238,242,248,0.55)',
    textMuted: 'rgba(238,242,248,0.26)',
    borderEdge: 'rgba(255,255,255,0.06)',
    accentColor: '#C8A96A',
    holeColor: '#2A3A5C',
    isLight: false,
  },
];

export function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i);
  return Math.abs(h);
}

export function getTagTheme(id: string): TagTheme {
  return TAG_THEMES[hashId(id) % TAG_THEMES.length];
}

export function getTagRotation(id: string): number {
  return (hashId(id) % 30 - 15) / 10; // -1.5 to +1.5
}
