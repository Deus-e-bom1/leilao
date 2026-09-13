const MY_BIDS_KEY = "my-bids";
const MY_BIDS_EVENT = "my-bids-change";

export function readBidSlugs(): string[] {
  try {
    const raw = window.localStorage.getItem(MY_BIDS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function emitChange() {
  window.dispatchEvent(new Event(MY_BIDS_EVENT));
}

export function writeBidSlugs(slugs: string[]) {
  try {
    window.localStorage.setItem(MY_BIDS_KEY, JSON.stringify(slugs));
  } catch {
    /* armazenamento indisponível */
  }
  emitChange();
}

export function addBidSlug(slug: string) {
  const current = readBidSlugs();
  const repeated = current.includes(slug);
  const next = repeated ? current : [...current, slug];
  writeBidSlugs(next);
  return { repeated, count: next.length };
}

export function clearBidSlugs() {
  try {
    window.localStorage.removeItem(MY_BIDS_KEY);
  } catch {
    /* armazenamento indisponível */
  }
  emitChange();
}

export function onBidSlugsChange(callback: () => void) {
  const handler = () => callback();
  window.addEventListener(MY_BIDS_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(MY_BIDS_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
