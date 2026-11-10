/** Catalog, toolbars, help, stats and toast UI. Markup lives in app.html. */

import type { Category, ObjectDef } from '../catalog/types';
import { CATEGORY_META, CATEGORY_ORDER, type ObjectRegistry } from '../catalog/registry';
import { mountGooeyNav, type GooeyNavController } from './gooeyNavMount';

export type Tool = 'grab' | 'spawn' | 'blast' | 'delete';

const TOOL_ITEMS: { id: Tool; label: string; icon: string; badge: string; title: string }[] = [
  { id: 'grab', label: 'Grab', icon: '✋', badge: 'G', title: 'Grab & throw (G)' },
  { id: 'spawn', label: 'Spawn', icon: '✦', badge: 'S', title: 'Spawn selected object (S)' },
  { id: 'blast', label: 'Blast', icon: '✸', badge: 'B', title: 'Create an explosion (B)' },
  { id: 'delete', label: 'Delete', icon: '⌫', badge: 'X', title: 'Delete object (X)' }
];

const TOOLS = ['#b8ff5a', '#ffb347', '#ff8a5c', '#ff6b6b'];

export interface UiCallbacks {
  onSelect: (defId: string) => void;
  onTool: (tool: Tool) => void;
  onTogglePause: () => void;
  onToggleSlow: () => void;
  onClear: () => void;
  onResetView: () => void;
  onScale: (scale: number) => void;
  onHelpChange: (open: boolean) => void;
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
        title: entry.id === 'all' ? 'Every object' : CATEGORY_META[entry.id].hint
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
      }
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
      }
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
