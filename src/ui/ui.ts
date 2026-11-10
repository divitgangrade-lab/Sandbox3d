/** Catalog, toolbars, help, stats and toast UI. All markup lives in index.html. */

import type { Category, ObjectDef } from '../catalog/types';
import { CATEGORY_META, CATEGORY_ORDER, type ObjectRegistry } from '../catalog/registry';

export type Tool = 'grab' | 'spawn' | 'blast' | 'delete';

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
  private readonly categoryButtons = new Map<string, HTMLButtonElement>();
  private activeCategory: Category | 'all' = 'all';
  private selectedId = '';
  private toastTimer: number | null = null;

  constructor(
    private readonly registry: ObjectRegistry,
    private readonly callbacks: UiCallbacks,
  ) {
    this.buildCategories();
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
    const fragment = document.createDocumentFragment();
    for (const entry of entries) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `cat${entry.id === 'all' ? ' active' : ''}`;
      button.dataset.category = entry.id;
      button.title = entry.id === 'all' ? 'Every object' : CATEGORY_META[entry.id].hint;
      button.innerHTML = `<span class="cat-icon"></span><span class="cat-label"></span><span class="cat-count"></span>`;
      button.querySelector('.cat-icon')!.textContent = entry.icon;
      button.querySelector('.cat-label')!.textContent = entry.label;
      button.querySelector('.cat-count')!.textContent = String(entry.count);
      button.addEventListener('click', () => {
        this.activeCategory = entry.id;
        for (const [id, btn] of this.categoryButtons) btn.classList.toggle('active', id === entry.id);
        this.renderItems();
      });
      this.categoryButtons.set(entry.id, button);
      fragment.append(button);
    }
    this.categoriesEl.replaceChildren(fragment);
  }

  private bind(): void {
    this.searchEl.addEventListener('input', () => this.renderItems());
    this.scaleEl.addEventListener('input', () => {
      const scale = Number(this.scaleEl.value);
      this.scaleValue.value = `${scale.toFixed(1)}×`;
      this.callbacks.onScale(scale);
    });
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) {
      button.addEventListener('click', () => {
        const tool = button.dataset.tool as Tool;
        if (tool) this.callbacks.onTool(tool);
      });
    }
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
    button.className = `item${def.id === this.selectedId ? ' active' : ''}`;
    button.dataset.id = def.id;
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
      for (const [id, btn] of this.categoryButtons) btn.classList.toggle('active', id === 'all');
      this.renderItems();
    }
  }

  setTool(tool: Tool): void {
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) {
      button.classList.toggle('active', button.dataset.tool === tool);
    }
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

  get scale(): number {
    return Number(this.scaleEl.value);
  }

  setScale(scale: number): void {
    this.scaleEl.value = String(scale);
    this.scaleValue.value = `${scale.toFixed(1)}×`;
  }
}
