// Preload audio instances to avoid first-play delay
const cache = new Map<string, HTMLAudioElement>();

function get(src: string): HTMLAudioElement {
  if (!cache.has(src)) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    cache.set(src, audio);
  }
  return cache.get(src)!;
}

function play(src: string, volume = 0.35) {
  try {
    const audio = get(src);
    const clone = audio.cloneNode() as HTMLAudioElement;
    clone.volume = volume;
    clone.play().catch(() => {/* user hasn't interacted yet, silently skip */});
  } catch {
    // ignore
  }
}

export const sfx = {
  // Card / navigation — ButtonClickDown: 像拿起实物的触感
  cardClick:   () => play('/sounds/ButtonClickDown.mp3', 0.32),
  // Card hover — 低沉轻触，像拿起吊牌的重量感
  cardHover:   () => play('/sounds/Thump.mp3', 0.09),
  // Filter / toggle
  filterClick: () => play('/sounds/Click.mp3', 0.28),
  toggle:      () => play('/sounds/MenuItemClick.mp3', 0.28),
  // Modal
  modalOpen:   () => play('/sounds/WindowOpen.mp3', 0.30),
  modalClose:  () => play('/sounds/WindowClose.mp3', 0.28),
  // Actions
  deleteItem:  () => play('/sounds/Thump.mp3', 0.35),
  // Rating
  ratingClick: () => play('/sounds/InputRadioClickDown.mp3', 0.25),
};
