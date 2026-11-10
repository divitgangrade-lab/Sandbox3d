/** Pointer + keyboard input with camera drag accumulation and one-shot key presses. */

export type PointerHandler = (event: PointerEvent) => void;

export class Input {
  readonly keys = new Set<string>();
  readonly justPressed = new Set<string>();
  lookX = 0;
  lookY = 0;
  panX = 0;
  panY = 0;
  wheel = 0;
  ndcX = 0;
  ndcY = 0;
  clientX = 0;
  clientY = 0;
  primaryDown = false;
  ctrlKey = false;
  metaKey = false;
  shiftKey = false;

  private readonly downButtons = new Set<number>();
  private lastX = 0;
  private lastY = 0;
  private readonly downHandlers = new Set<PointerHandler>();
  private readonly upHandlers = new Set<PointerHandler>();
  private readonly moveHandlers = new Set<PointerHandler>();
  private readonly disposers: (() => void)[] = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    const on = <K extends keyof WindowEventMap>(
      target: Window | HTMLElement,
      type: K,
      handler: (event: WindowEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, handler as EventListener, options);
      this.disposers.push(() => target.removeEventListener(type, handler as EventListener, options));
    };

    on(canvas, 'pointerdown', (event) => this.pointerDown(event));
    on(canvas, 'pointermove', (event) => this.pointerMove(event));
    on(canvas, 'pointerup', (event) => this.pointerUp(event));
    on(canvas, 'pointercancel', (event) => this.pointerCancel(event));
    on(canvas, 'wheel', (event) => this.onWheel(event), { passive: false });
    on(canvas, 'contextmenu', (event) => event.preventDefault());

    on(window, 'keydown', (event) => this.keyDown(event));
    on(window, 'keyup', (event) => {
      this.keys.delete(event.code);
      this.ctrlKey = event.ctrlKey;
      this.metaKey = event.metaKey;
      this.shiftKey = event.shiftKey;
    });
    on(window, 'blur', () => {
      this.keys.clear();
      this.justPressed.clear();
      this.primaryDown = false;
      this.downButtons.clear();
      this.ctrlKey = false;
      this.metaKey = false;
      this.shiftKey = false;
      // A pointerup will never arrive after focus is lost, so release any active grab here.
      const cancel = new Event('pointercancel') as PointerEvent;
      for (const handler of this.upHandlers) handler(cancel);
    });
  }

  private updatePosition(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.clientX = event.clientX;
    this.clientY = event.clientY;
    this.ndcX = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    this.ndcY = -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
  }

  private pointerDown(event: PointerEvent): void {
    this.updatePosition(event);
    this.downButtons.add(event.button);
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    if (event.button === 0) this.primaryDown = true;
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail if the pointer was already released.
    }
    if (event.button === 0 && !event.shiftKey) {
      for (const handler of this.downHandlers) handler(event);
    }
  }

  private pointerMove(event: PointerEvent): void {
    this.updatePosition(event);
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    if (this.downButtons.has(2)) {
      this.lookX += dx;
      this.lookY += dy;
    } else if (this.downButtons.has(1) || (this.downButtons.has(0) && event.shiftKey)) {
      this.panX += dx;
      this.panY += dy;
    }
    for (const handler of this.moveHandlers) handler(event);
  }

  private pointerUp(event: PointerEvent): void {
    this.downButtons.delete(event.button);
    if (event.button === 0) this.primaryDown = false;
    for (const handler of this.upHandlers) handler(event);
  }

  /**
   * Browsers omit the button on a canceled pointer. Treat it as an unconditional release so a
   * grabbed body can never be stranded when touch input, a context menu or the OS steals it.
   */
  private pointerCancel(event: PointerEvent): void {
    this.downButtons.clear();
    this.primaryDown = false;
    for (const handler of this.upHandlers) handler(event);
  }

  /** Pan keys belong to the camera unless a vehicle is being driven. */
  cameraPanEnabled = true;

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.wheel += event.deltaY;
  }

  private keyDown(event: KeyboardEvent): void {
    this.ctrlKey = event.ctrlKey;
    this.metaKey = event.metaKey;
    this.shiftKey = event.shiftKey;
    const target = event.target as HTMLElement | null;
    const typing =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable;
    if (typing) {
      if (event.code === 'Escape') {
        // Let the game close an open overlay, then drop focus from the field.
        if (!event.repeat) this.justPressed.add('Escape');
        (target as HTMLElement).blur();
      }
      return;
    }
    if (!event.repeat) this.justPressed.add(event.code);
    this.keys.add(event.code);
    if ((event.ctrlKey || event.metaKey) && (event.code === 'KeyS' || event.code === 'KeyZ' || event.code === 'KeyY')) {
      event.preventDefault();
    }
    if (
      event.code === 'Space' ||
      event.code === 'ArrowUp' ||
      event.code === 'ArrowDown' ||
      event.code === 'ArrowLeft' ||
      event.code === 'ArrowRight' ||
      event.code === 'Slash'
    ) {
      event.preventDefault();
    }
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  wasPressed(code: string): boolean {
    return this.justPressed.has(code);
  }

  onPointerDown(handler: PointerHandler): () => void {
    this.downHandlers.add(handler);
    return () => this.downHandlers.delete(handler);
  }

  onPointerUp(handler: PointerHandler): () => void {
    this.upHandlers.add(handler);
    return () => this.upHandlers.delete(handler);
  }

  onPointerMove(handler: PointerHandler): () => void {
    this.moveHandlers.add(handler);
    return () => this.moveHandlers.delete(handler);
  }

  endFrame(): void {
    this.lookX = 0;
    this.lookY = 0;
    this.panX = 0;
    this.panY = 0;
    this.wheel = 0;
    this.justPressed.clear();
  }

  dispose(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}
