import { MemoryStorageAdapter } from "./memory-adapter";

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
 * Returns the appropriate storage adapter based on the current environment
 * - Web Browser: localStorage
 * - Server (Next.js SSR): MemoryStorageAdapter
 */
export function getStorageAdapter(): StorageAdapter {
  // Server-side environment (including Next.js SSR)
  if (isServer()) {
    return MemoryStorageAdapter;
  }

  // Web environment - use localStorage with Promise wrapper
  if (typeof window !== "undefined" && window.localStorage) {
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
          console.error("localStorage.setItem failed:", e);
          throw e;
        }
      },
      removeItem: async (key: string) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.error("localStorage.removeItem failed:", e);
          throw e;
        }
      },
    };
  }

  // Fallback to memory adapter if no other storage is available
  return MemoryStorageAdapter;
}
