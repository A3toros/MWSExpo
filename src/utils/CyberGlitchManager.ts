type Listener = (activeId: string | null) => void;

class CyberGlitchManagerImpl {
  private listeners: Set<Listener> = new Set();
  private ids: Set<string> = new Set();
  private activeId: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  register(id: string) {
    this.ids.add(id);
    // If nothing active yet, activate one immediately
    if (this.activeId === null) {
      this.activeId = id;
      this.emit();
    }
    if (!this.timer) this.scheduleNext();
  }

  unregister(id: string) {
    this.ids.delete(id);
    if (this.activeId === id) {
      this.activeId = null;
      this.emit();
    }
    if (this.ids.size === 0 && this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.activeId);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    // Debug: log current active id to verify rotation
    if (typeof console !== 'undefined') {
      console.log('[CyberGlitchManager] activeId =', this.activeId);
    }
    for (const l of this.listeners) l(this.activeId);
  }

  private scheduleNext() {
    const delay = 1000 + Math.random() * 9000; // 1–10s
    this.timer = setTimeout(() => {
      const ids = Array.from(this.ids);
      if (ids.length > 0) {
        let next = ids[Math.floor(Math.random() * ids.length)];
        if (ids.length > 1) {
          // Try to pick a different id than current when possible
          for (let i = 0; i < 3 && next === this.activeId; i++) {
            next = ids[Math.floor(Math.random() * ids.length)];
          }
        }
        this.activeId = next;
        this.emit();
      } else {
        this.activeId = null;
        this.emit();
      }
      this.scheduleNext();
    }, delay);
  }
}

export const CyberGlitchManager = new CyberGlitchManagerImpl();


