/**
 * In-memory storage adapter for server-side environments
 * This adapter is used when localStorage and AsyncStorage are not available
 */
export class MemoryStorageAdapter {
  private static storage: Record<string, string> = {};

  static getItem = async (key: string): Promise<string | null> => {
    return MemoryStorageAdapter.storage[key] || null;
  };

  static setItem = async (key: string, value: string): Promise<void> => {
    MemoryStorageAdapter.storage[key] = value;
  };

  static removeItem = async (key: string): Promise<void> => {
    delete MemoryStorageAdapter.storage[key];
  };
}