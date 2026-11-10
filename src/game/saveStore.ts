/** Browser save-slot storage. Snapshot validation stays in sim/persistence. */

import {
  parseWorldSnapshot,
  serializeWorldSnapshot,
  WORLD_FORMAT_VERSION,
  type WorldSnapshot,
} from '../sim/persistence';

const INDEX_KEY = 'sandbox3d.saves.index.v1';
const SLOT_PREFIX = 'sandbox3d.saves.slot.v1.';
const MAX_SLOTS = 20;

export interface SaveSummary {
  id: string;
  name: string;
  savedAt: number;
  objects: number;
}

interface SaveIndex {
  version: number;
  slots: SaveSummary[];
}

function makeId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36)}-${random}`;
}

function assertStorage(): Storage {
  try {
    const key = 'sandbox3d.storage-test';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return localStorage;
  } catch {
    throw new Error('Browser storage is unavailable. Export a JSON file instead.');
  }
}

export class SaveStore {
  private readIndex(): SaveSummary[] {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Partial<SaveIndex>;
      if (parsed.version !== 1 || !Array.isArray(parsed.slots)) return [];
      return parsed.slots
        .filter(
          (slot): slot is SaveSummary =>
            !!slot &&
            typeof slot.id === 'string' &&
            typeof slot.name === 'string' &&
            Number.isFinite(slot.savedAt) &&
            Number.isFinite(slot.objects),
        )
        .sort((a, b) => b.savedAt - a.savedAt);
    } catch {
      return [];
    }
  }

  private writeIndex(slots: SaveSummary[]): void {
    const index: SaveIndex = { version: 1, slots };
    assertStorage().setItem(INDEX_KEY, JSON.stringify(index));
  }

  list(): SaveSummary[] {
    return this.readIndex();
  }

  save(name: string, snapshot: WorldSnapshot): SaveSummary {
    const clean = name.trim().slice(0, 48) || 'Untitled world';
    const existing = this.readIndex();
    if (existing.length >= MAX_SLOTS) {
      throw new Error(`You already have ${MAX_SLOTS} saves. Delete one first.`);
    }
    const storage = assertStorage();
    const summary: SaveSummary = {
      id: makeId(),
      name: clean,
      savedAt: Date.now(),
      objects: snapshot.entities.length,
    };
    const copy: WorldSnapshot = {
      ...snapshot,
      savedAt: summary.savedAt,
      entities: snapshot.entities.map((entity) => ({ ...entity })),
    };
    try {
      storage.setItem(`${SLOT_PREFIX}${summary.id}`, serializeWorldSnapshot(copy));
      this.writeIndex([summary, ...existing]);
    } catch (error) {
      storage.removeItem(`${SLOT_PREFIX}${summary.id}`);
      throw new Error(
        error instanceof DOMException && error.name === 'QuotaExceededError'
          ? 'Save storage is full. Export a JSON file and delete an old save.'
          : 'Could not write the save to browser storage.',
      );
    }
    return summary;
  }

  load(id: string): WorldSnapshot {
    let raw: string | null = null;
    try {
      raw = assertStorage().getItem(`${SLOT_PREFIX}${id}`);
    } catch {
      throw new Error('Browser storage is unavailable.');
    }
    if (!raw) throw new Error('That save no longer exists.');
    return parseWorldSnapshot(raw);
  }

  delete(id: string): void {
    const storage = assertStorage();
    storage.removeItem(`${SLOT_PREFIX}${id}`);
    this.writeIndex(this.readIndex().filter((slot) => slot.id !== id));
  }

  clear(): void {
    const storage = assertStorage();
    for (const slot of this.readIndex()) storage.removeItem(`${SLOT_PREFIX}${slot.id}`);
    storage.removeItem(INDEX_KEY);
  }

  get version(): number {
    return WORLD_FORMAT_VERSION;
  }
}
