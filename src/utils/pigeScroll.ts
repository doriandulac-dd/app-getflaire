export type PigeScrollState = {
  scrollTop: number;
  loadedCount: number;
  restorePending: boolean;
};

const PIGE_SCROLL_STATE_KEY = 'getflaire:pige-scroll-state';

export const getAppScrollContainer = () =>
  document.querySelector<HTMLElement>('[data-scroll-restoration-container="true"]');

export const readAppScrollTop = () => getAppScrollContainer()?.scrollTop ?? window.scrollY ?? 0;

export const scrollAppTo = (top: number) => {
  getAppScrollContainer()?.scrollTo({ top, left: 0, behavior: 'auto' });
  window.scrollTo({ top, left: 0, behavior: 'auto' });
};

export const readPigeScrollState = (): PigeScrollState | null => {
  const rawState = sessionStorage.getItem(PIGE_SCROLL_STATE_KEY);
  if (!rawState) return null;

  try {
    const parsed = JSON.parse(rawState) as Partial<PigeScrollState>;
    if (typeof parsed.scrollTop !== 'number' || typeof parsed.loadedCount !== 'number') {
      return null;
    }

    return {
      scrollTop: parsed.scrollTop,
      loadedCount: parsed.loadedCount,
      restorePending: Boolean(parsed.restorePending),
    };
  } catch {
    return null;
  }
};

export const savePigeScrollState = (state: PigeScrollState) => {
  sessionStorage.setItem(PIGE_SCROLL_STATE_KEY, JSON.stringify(state));
};

export const clearPigeScrollState = () => {
  sessionStorage.removeItem(PIGE_SCROLL_STATE_KEY);
};
