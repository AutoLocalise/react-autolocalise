export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

/**
 * Detects if the code is running in a server environment
 * This includes Node.js environments like Next.js SSR
 */
export function isServer(): boolean {
  return typeof window === "undefined";
}

/**
 * Returns the localStorage adapter for client-side storage
 * Note: This should only be called on client-side, not SSR
 */
export function getStorageAdapter(): StorageAdapter {
  return {
    getItem: async (key: string) => {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.error("localStorage.getItem failed:", e);
        return null;
      }
    },
    setItem: async (key: string, value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn("localStorage.setItem failed:", e);
      }
    },
    removeItem: async (key: string) => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn("localStorage.removeItem failed:", e);
      }
    },
  };
}
