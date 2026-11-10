/** Catalog, toolbars, inspector, saves, help, stats and toast UI. Markup lives in app.html. */

import type { Category, ObjectDef } from '../catalog/types';
import { CATEGORY_META, CATEGORY_ORDER, type ObjectRegistry } from '../catalog/registry';
import { mountGooeyNav, type GooeyNavController } from './gooeyNavMount';
import type { SaveSummary } from '../game/saveStore';
import type { InspectorInfo } from './inspector';

export type Tool = 'grab' | 'spawn' | 'blast' | 'delete' | 'build';
export type BuildAction =
  | 'left'
  | 'right'
  | 'forward'
  | 'back'
  | 'rotate-left'
  | 'rotate-right'
  | 'scale-down'
  | 'scale-up'
  | 'duplicate'
  | 'delete'
  | 'focus';

const TOOL_ITEMS: { id: Tool; label: string; icon: string; badge: string; title: string }[] = [
  { id: 'grab', label: 'Grab', icon: '✋', badge: 'G', title: 'Grab & throw (G)' },
  { id: 'spawn', label: 'Spawn', icon: '✦', badge: 'S', title: 'Spawn selected object (S)' },
  { id: 'blast', label: 'Blast', icon: '✸', badge: 'B', title: 'Create an explosion (B)' },
  { id: 'delete', label: 'Delete', icon: '⌫', badge: 'X', title: 'Delete object (X)' },
  { id: 'build', label: 'Build', icon: '⚙', badge: 'V', title: 'Build & transform objects (V)' },
];

const TOOLS = ['#b8ff5a', '#d8b46a', '#c9a06a', '#d98c86', '#9fbfa6'];

export interface UiCallbacks {
  onSelect: (defId: string) => void;
  onTool: (tool: Tool) => void;
  onTogglePause: () => void;
  onToggleSlow: () => void;
  onClear: () => void;
  onResetView: () => void;
  onScale: (scale: number) => void;
  onHelpChange: (open: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSavesOpened: () => void;
  onSaveWorld: (name: string) => void;
  onLoadSave: (id: string) => void;
  onDeleteSave: (id: string) => void;
  onExportSave: () => void;
  onImportSave: (text: string) => void;
  onGravity: (gravity: number) => void;
  onBuildAction: (action: BuildAction) => void;
  onToggleSnap: () => void;
  onGridSize: (size: number) => void;
}

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing UI element #${id}`);
  return node as T;
}

export class UI {
  private readonly categoriesEl = byId<HTMLDivElement>('categories');
  private readonly toolsEl = byId<HTMLDivElement>('gooey-tools');
  private readonly itemsEl = byId<HTMLDivElement>('items');
  private readonly searchEl = byId<HTMLInputElement>('search');
  private readonly countEl = byId<HTMLElement>('catalog-count');
  private readonly pickedIcon = byId<HTMLElement>('picked-icon');
  private readonly pickedName = byId<HTMLElement>('picked-name');
  private readonly pickedDesc = byId<HTMLElement>('picked-desc');
  private readonly scaleEl = byId<HTMLInputElement>('spawn-scale');
  private readonly scaleValue = byId<HTMLOutputElement>('spawn-scale-value');
  private readonly statsFps = byId<HTMLElement>('stat-fps');
  private readonly statsEntities = byId<HTMLElement>('stat-entities');
  private readonly statsBodies = byId<HTMLElement>('stat-bodies');
  private readonly statsCalls = byId<HTMLElement>('stat-calls');
  private readonly hintEl = byId<HTMLDivElement>('hint');
  private readonly toastEl = byId<HTMLDivElement>('toast');
  private readonly helpEl = byId<HTMLDivElement>('help');
  private readonly dragTipEl = byId<HTMLDivElement>('drag-tip');
  private readonly pauseBtn = byId<HTMLButtonElement>('btn-pause');
  private readonly slowBtn = byId<HTMLButtonElement>('btn-slow');
  private readonly undoBtn = byId<HTMLButtonElement>('btn-undo');
  private readonly redoBtn = byId<HTMLButtonElement>('btn-redo');
  private readonly gravityEl = byId<HTMLInputElement>('gravity-slider');
  private readonly gravityValue = byId<HTMLOutputElement>('gravity-value');
  private readonly inspectorEl = byId<HTMLElement>('inspector');
  private readonly inspectorName = byId<HTMLElement>('inspector-name');
  private readonly inspectorIcon = byId<HTMLElement>('inspector-icon');
  private readonly inspectorState = byId<HTMLElement>('inspector-state');
  private readonly inspectMass = byId<HTMLElement>('inspect-mass');
  private readonly inspectVelocity = byId<HTMLElement>('inspect-velocity');
  private readonly inspectPosition = byId<HTMLElement>('inspect-position');
  private readonly inspectRotation = byId<HTMLElement>('inspect-rotation');
  private readonly inspectMaterial = byId<HTMLElement>('inspect-material');
  private readonly inspectColliders = byId<HTMLElement>('inspect-colliders');
  private readonly inspectHealth = byId<HTMLElement>('inspect-health');
  private readonly inspectExtra = byId<HTMLElement>('inspect-extra');
  private readonly buildPanel = byId<HTMLElement>('build-panel');
  private readonly buildSelected = byId<HTMLElement>('build-selected');
  private readonly snapBtn = byId<HTMLButtonElement>('btn-snap');
  private readonly gridSelect = byId<HTMLSelectElement>('build-grid');
  private readonly savePanel = byId<HTMLDivElement>('save-panel');
  private readonly saveName = byId<HTMLInputElement>('save-name');
  private readonly saveList = byId<HTMLDivElement>('save-list');
  private readonly saveImport = byId<HTMLInputElement>('save-import');
  private categoryNav: GooeyNavController | null = null;
  private toolNav: GooeyNavController | null = null;
  private activeCategory: Category | 'all' = 'all';
  private selectedId = '';
  private toastTimer: number | null = null;

  constructor(
    private readonly registry: ObjectRegistry,
    private readonly callbacks: UiCallbacks,
  ) {
    this.buildCategories();
    this.buildTools();
    this.bind();
    this.renderItems();
  }

  private buildCategories(): void {
    const counts = this.registry.counts();
    const total = this.registry.visible().length;
    const entries: { id: Category | 'all'; label: string; icon: string; count: number }[] = [
      { id: 'all', label: 'All', icon: '◈', count: total },
      ...CATEGORY_ORDER.map((id) => ({
        id,
        label: CATEGORY_META[id].label,
        icon: CATEGORY_META[id].icon,
        count: counts[id] ?? 0,
      })),
    ];
    this.categoryNav = mountGooeyNav(this.categoriesEl, {
      ariaLabel: 'Object categories',
      items: entries.map((entry) => ({
        label: entry.label,
        icon: entry.icon,
        badge: String(entry.count),
        title: entry.id === 'all' ? 'Every object' : CATEGORY_META[entry.id].hint,
      })),
      initialActiveIndex: 0,
      className: 'gooey-nav--catalog',
      colors: ['#b8ff5a', '#8bf0c0', '#d9ff9a'],
      particleCount: 8,
      spread: 28,
      animationTime: 420,
      timeVariance: 180,
      gooeyness: 0.48,
      wobble: 0.35,
      cursorLabel: (_item, index) =>
        entries[index]?.id === 'all' ? 'Show all objects' : `Show ${entries[index]?.label}`,
      onSelect: (index) => {
        const entry = entries[index];
        if (!entry) return;
        this.activeCategory = entry.id;
        this.renderItems();
      },
    });
  }

  private buildTools(): void {
    const activeTool = TOOL_ITEMS.findIndex((tool) => tool.id === 'spawn');
    this.toolNav = mountGooeyNav(this.toolsEl, {
      ariaLabel: 'Tools',
      items: TOOL_ITEMS.map(({ label, icon, badge, title }) => ({ label, icon, badge, title })),
      initialActiveIndex: activeTool,
      className: 'gooey-nav--tools',
      colors: TOOLS,
      particleCount: 10,
      spread: 34,
      animationTime: 440,
      timeVariance: 180,
      gooeyness: 0.52,
      wobble: 0.4,
      cursorLabel: (item) => `${item.label} tool`,
      onSelect: (index) => {
        const tool = TOOL_ITEMS[index];
        if (tool) this.callbacks.onTool(tool.id);
      },
    });
  }

  private bind(): void {
    this.searchEl.addEventListener('input', () => this.renderItems());
    this.scaleEl.addEventListener('input', () => {
      const scale = Number(this.scaleEl.value);
      this.scaleValue.value = `${scale.toFixed(1)}×`;
      this.callbacks.onScale(scale);
    });
    byId('btn-pause').addEventListener('click', () => this.callbacks.onTogglePause());
    byId('btn-slow').addEventListener('click', () => this.callbacks.onToggleSlow());
    byId('btn-clear').addEventListener('click', () => this.callbacks.onClear());
    byId('btn-help').addEventListener('click', () => this.showHelp(!this.isHelpOpen));
    byId('btn-reset-view').addEventListener('click', () => this.callbacks.onResetView());
    byId('help-close').addEventListener('click', () => this.showHelp(false));
    byId('help-start').addEventListener('click', () => this.showHelp(false));
    this.helpEl.addEventListener('click', (event) => {
      if (event.target === this.helpEl) this.showHelp(false);
    });

    this.undoBtn.addEventListener('click', () => this.callbacks.onUndo());
    this.redoBtn.addEventListener('click', () => this.callbacks.onRedo());
    byId('btn-save').addEventListener('click', () => this.openSaves(true));
    this.gravityEl.addEventListener('input', () => {
      const value = Number(this.gravityEl.value);
      this.setGravity(value);
      this.callbacks.onGravity(value);
    });
    this.snapBtn.addEventListener('click', () => this.callbacks.onToggleSnap());
    this.gridSelect.addEventListener('change', () => {
      this.callbacks.onGridSize(Number(this.gridSelect.value));
    });
    for (const button of this.buildPanel.querySelectorAll<HTMLButtonElement>('[data-build-action]')) {
      button.addEventListener('click', () => {
        const action = button.dataset.buildAction as BuildAction | undefined;
        if (action) this.callbacks.onBuildAction(action);
      });
    }

    this.savePanel.addEventListener('click', (event) => {
      if (event.target === this.savePanel) this.openSaves(false);
    });
    byId('save-close').addEventListener('click', () => this.openSaves(false));
    byId('save-create').addEventListener('click', () => {
      const fallback = `World ${new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
      }).format(new Date())}`;
      this.callbacks.onSaveWorld(this.saveName.value.trim() || fallback);
    });
    this.saveName.addEventListener('keydown', (event) => {
      // Enter also confirms an IME composition; only an explicit submit should save.
      if (event.key === 'Enter' && !event.isComposing) {
        byId<HTMLButtonElement>('save-create').click();
      }
    });
    byId('save-export').addEventListener('click', () => this.callbacks.onExportSave());
    byId('save-import-trigger').addEventListener('click', () => this.saveImport.click());
    this.saveImport.addEventListener('change', () => {
      const file = this.saveImport.files?.[0];
      if (!file) return;
      file
        .text()
        .then((text) => this.callbacks.onImportSave(text))
        .catch(() => this.toast('Could not read that file', 'warn'));
      this.saveImport.value = '';
    });
  }

  private renderItems(): void {
    const query = this.searchEl.value;
    const category = this.activeCategory === 'all' ? undefined : this.activeCategory;
    const defs = this.registry.search(query, { category });
    this.countEl.textContent = String(defs.length);
    const fragment = document.createDocumentFragment();
    if (defs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'items-empty';
      empty.textContent = `No objects match “${query.trim()}”.`;
      fragment.append(empty);
    } else {
      for (const def of defs) fragment.append(this.itemCard(def));
    }
    this.itemsEl.replaceChildren(fragment);
  }

  private itemCard(def: ObjectDef): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `item cursor-target${def.id === this.selectedId ? ' active' : ''}`;
    button.dataset.id = def.id;
    button.dataset.cursorLabel = `Select ${def.name}`;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(def.id === this.selectedId));
    button.title = def.description ?? def.name;

    const icon = document.createElement('span');
    icon.className = 'item-icon';
    icon.textContent = def.icon ?? '▣';

    const body = document.createElement('span');
    body.className = 'item-body';
    const name = document.createElement('span');
    name.className = 'item-name';
    name.textContent = def.name;
    const meta = document.createElement('span');
    meta.className = 'item-meta';
    meta.textContent = def.tags?.slice(0, 2).join(' · ') ?? def.category;
    body.append(name, meta);

    button.append(icon, body);
    button.addEventListener('click', () => this.callbacks.onSelect(def.id));
    return button;
  }

  setSelected(def: ObjectDef): void {
    this.selectedId = def.id;
    this.pickedIcon.textContent = def.icon ?? '▣';
    this.pickedName.textContent = def.name;
    this.pickedDesc.textContent = def.description ?? 'Click the world to spawn it';
    for (const card of this.itemsEl.querySelectorAll<HTMLElement>('.item')) {
      const active = card.dataset.id === def.id;
      card.classList.toggle('active', active);
      card.setAttribute('aria-selected', String(active));
    }
    // If the selected item is filtered out, clear the filter so the pick is visible.
    if (!this.itemsEl.querySelector(`[data-id="${CSS.escape(def.id)}"]`)) {
      this.activeCategory = 'all';
      this.searchEl.value = '';
      this.categoryNav?.setActive(0);
      this.renderItems();
    }
  }

  setTool(tool: Tool): void {
    const index = TOOL_ITEMS.findIndex((item) => item.id === tool);
    if (index >= 0) this.toolNav?.setActive(index);
  }

  setPaused(paused: boolean): void {
    this.pauseBtn.textContent = paused ? '▶' : '❚❚';
    this.pauseBtn.classList.toggle('active', paused);
    this.pauseBtn.title = paused ? 'Resume physics (Space)' : 'Pause physics (Space)';
  }

  setSlow(slow: boolean): void {
    this.slowBtn.classList.toggle('active', slow);
    this.slowBtn.title = slow ? 'Normal speed (T)' : 'Slow motion (T)';
  }

  setStats(stats: { fps: number; entities: number; bodies: number; calls: number }): void {
    this.statsFps.textContent = String(stats.fps);
    this.statsEntities.textContent = String(stats.entities);
    this.statsBodies.textContent = String(stats.bodies);
    this.statsCalls.textContent = String(stats.calls);
  }

  setUndoRedo(canUndo: boolean, canRedo: boolean, undoLabel: string | null, redoLabel: string | null): void {
    this.undoBtn.disabled = !canUndo;
    this.redoBtn.disabled = !canRedo;
    this.undoBtn.title = canUndo ? `Undo ${undoLabel ?? ''} (Ctrl+Z)`.trim() : 'Nothing to undo';
    this.redoBtn.title = canRedo ? `Redo ${redoLabel ?? ''} (Ctrl+Shift+Z)`.trim() : 'Nothing to redo';
  }

  setGravity(value: number): void {
    this.gravityEl.value = String(value);
    this.gravityValue.value = value.toFixed(1);
  }

  setInspector(info: InspectorInfo | null): void {
    if (!info) {
      this.inspectorEl.hidden = true;
      return;
    }
    this.inspectorEl.hidden = false;
    this.inspectorName.textContent = info.name;
    this.inspectorIcon.textContent = info.icon;
    this.inspectorState.textContent = info.state;
    this.inspectMass.textContent = `${info.mass.toFixed(1)} kg`;
    this.inspectVelocity.textContent = `${info.velocity.toFixed(1)} m/s`;
    this.inspectPosition.textContent = info.position.map((v) => v.toFixed(1)).join(', ');
    this.inspectRotation.textContent = `${info.rotation.map((v) => Math.round(v)).join('° / ')}°`;
    this.inspectMaterial.textContent = info.material;
    this.inspectColliders.textContent = String(info.colliders);
    this.inspectHealth.textContent = info.health;
    this.inspectExtra.textContent = info.extra || '—';
  }

  setBuild(active: boolean): void {
    this.buildPanel.hidden = !active;
    if (active) {
      this.inspectorEl.hidden = true;
      this.buildSelected.textContent = 'Select an object';
    }
  }

  setBuildSelection(name: string | null): void {
    this.buildSelected.textContent = name ?? 'Select an object';
    for (const button of this.buildPanel.querySelectorAll<HTMLButtonElement>('[data-build-action]')) {
      button.disabled = !name;
    }
  }

  setSnap(on: boolean): void {
    this.snapBtn.textContent = on ? 'Snap on' : 'Snap off';
    this.snapBtn.classList.toggle('active', on);
    this.snapBtn.setAttribute('aria-pressed', String(on));
  }

  setGridSize(size: number): void {
    this.gridSelect.value = String(size);
  }

  setSaveSlots(slots: SaveSummary[]): void {
    const fragment = document.createDocumentFragment();
    if (slots.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'save-empty';
      empty.textContent = 'No saved worlds yet. Give this one a name above.';
      fragment.append(empty);
    }
    for (const slot of slots) {
      const row = document.createElement('div');
      row.className = 'save-row';
      const meta = document.createElement('div');
      meta.className = 'save-meta';
      const name = document.createElement('b');
      name.textContent = slot.name;
      const detail = document.createElement('span');
      const date = new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(slot.savedAt));
      detail.textContent = `${date} · ${slot.objects} object${slot.objects === 1 ? '' : 's'}`;
      meta.append(name, detail);
      const actions = document.createElement('div');
      actions.className = 'save-row-actions';
      const load = document.createElement('button');
      load.type = 'button';
      load.className = 'ghost-btn cursor-target';
      load.textContent = 'Load';
      load.dataset.cursorLabel = `Load ${slot.name}`;
      load.addEventListener('click', () => this.callbacks.onLoadSave(slot.id));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ghost-btn danger cursor-target';
      remove.textContent = 'Delete';
      remove.dataset.cursorLabel = `Delete ${slot.name}`;
      remove.addEventListener('click', () => {
        if (window.confirm(`Delete “${slot.name}”? This cannot be undone.`)) {
          this.callbacks.onDeleteSave(slot.id);
        }
      });
      actions.append(load, remove);
      row.append(meta, actions);
      fragment.append(row);
    }
    this.saveList.replaceChildren(fragment);
  }

  openSaves(open: boolean): void {
    if (this.savePanel.hidden === !open) return;
    this.savePanel.hidden = !open;
    document.body.classList.toggle('save-open', open);
    if (open) {
      this.showHelp(false);
      this.searchEl.blur();
      this.callbacks.onSavesOpened();
      window.setTimeout(() => this.saveName.focus(), 60);
    }
  }

  clearSaveName(): void {
    this.saveName.value = '';
  }

  get isSaveOpen(): boolean {
    return !this.savePanel.hidden;
  }

  get isOverlayOpen(): boolean {
    return this.isHelpOpen || this.isSaveOpen;
  }

  setHint(text: string): void {
    if (this.hintEl.textContent === text) return;
    this.hintEl.textContent = text;
  }

  setDragTip(visible: boolean, x = 0, y = 0): void {
    this.dragTipEl.hidden = !visible;
    if (visible) this.dragTipEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -170%)`;
  }

  toast(message: string, tone: 'info' | 'warn' | 'good' = 'info'): void {
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastEl.textContent = message;
    this.toastEl.className = `toast show ${tone}`;
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.className = 'toast';
      this.toastTimer = null;
    }, 2400);
  }

  get isHelpOpen(): boolean {
    return !this.helpEl.hidden;
  }

  showHelp(open: boolean): void {
    if (this.helpEl.hidden === !open) return;
    this.helpEl.hidden = !open;
    document.body.classList.toggle('help-open', open);
    this.callbacks.onHelpChange(open);
  }

  focusSearch(): void {
    this.searchEl.focus();
    this.searchEl.select();
  }

  blurSearch(): void {
    this.searchEl.blur();
  }

  get scale(): number {
    return Number(this.scaleEl.value);
  }

  setScale(scale: number): void {
    this.scaleEl.value = String(scale);
    this.scaleValue.value = `${scale.toFixed(1)}×`;
  }

  dispose(): void {
    this.categoryNav?.dispose();
    this.categoryNav = null;
    this.toolNav?.dispose();
    this.toolNav = null;
  }
}
