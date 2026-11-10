/** Bounded undo/redo history built on complete, serializable world snapshots. */

import type { WorldSnapshot } from './persistence';

export interface HistoryEntry {
  label: string;
  snapshot: WorldSnapshot;
}

export const DEFAULT_HISTORY_LIMIT = 30;

export class WorldHistory {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  constructor(
    private readonly capture: () => WorldSnapshot,
    private readonly restore: (snapshot: WorldSnapshot) => void,
    readonly limit = DEFAULT_HISTORY_LIMIT,
  ) {
    this.limit = Math.max(1, Math.floor(limit));
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoLabel(): string | null {
    return this.undoStack[this.undoStack.length - 1]?.label ?? null;
  }

  get redoLabel(): string | null {
    return this.redoStack[this.redoStack.length - 1]?.label ?? null;
  }

  get size(): number {
    return this.undoStack.length;
  }

  /** Capture state before a user action. Call once per action, before mutating the world. */
  record(label: string): void {
    this.undoStack.push({ label, snapshot: this.capture() });
    if (this.undoStack.length > this.limit) this.undoStack.splice(0, this.undoStack.length - this.limit);
    this.redoStack = [];
  }

  /** Remove the most recent record when the action it guarded failed. */
  discardLast(): void {
    this.undoStack.pop();
  }

  undo(): string | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push({ label: entry.label, snapshot: this.capture() });
    this.restore(entry.snapshot);
    return entry.label;
  }

  redo(): string | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push({ label: entry.label, snapshot: this.capture() });
    if (this.undoStack.length > this.limit) this.undoStack.splice(0, this.undoStack.length - this.limit);
    this.restore(entry.snapshot);
    return entry.label;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
