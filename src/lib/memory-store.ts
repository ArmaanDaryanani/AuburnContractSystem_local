// In-memory store that persists only during SPA navigation
// Clears on page refresh

class MemoryStore {
  private store: Map<string, any> = new Map();

  set(key: string, value: any) {
    this.store.set(key, value);
  }

  get(key: string) {
    return this.store.get(key);
  }

  delete(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  has(key: string) {
    return this.store.has(key);
  }
}

// Singleton instance - persists during SPA navigation, resets on page refresh
export const memoryStore = new MemoryStore();