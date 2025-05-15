import { vi } from 'vitest'

/**
 * Mock implementation of LevelDBStorage for testing
 */
export class MockLevelDBStorage<T> {
  private data = new Map<string, string>()

  async saveItem(key: string, item: T): Promise<void> {
    this.data.set(key, JSON.stringify(item))
  }

  async getItem(key: string): Promise<null | T> {
    const value = this.data.get(key)
    if (!value) {
      return null
    }

    return JSON.parse(value) as T
  }

  async deleteItem(key: string): Promise<void> {
    this.data.delete(key)
  }

  async clearOldItems(prefix: string, _cutoffDate: Date): Promise<void> {
    // In a real implementation, we would only clear items older than cutoffDate
    // For the mock, we'll just clear all items with the prefix
    for (const key of this.data.keys()) {
      if (key.startsWith(prefix)) {
        this.data.delete(key)
      }
    }
  }

  async getAllKeys(prefix: string): Promise<string[]> {
    const keys: string[] = []
    for (const key of this.data.keys()) {
      if (key.startsWith(prefix)) {
        keys.push(key)
      }
    }

    return keys
  }

  async getAllItems(prefix: string): Promise<T[]> {
    const items: T[] = []
    for (const [key, value] of this.data.entries()) {
      if (key.startsWith(prefix)) {
        items.push(JSON.parse(value) as T)
      }
    }

    return items
  }

  async close(): Promise<void> {
    // No-op in mock
  }
}

/**
 * Create a mock of LevelDBStorage for vitest
 */
export function createLevelDBStorageMock<_T>() {
  return {
    clearOldItems: vi.fn(),
    close: vi.fn(),
    deleteItem: vi.fn(),
    getAllItems: vi.fn(),
    getAllKeys: vi.fn(),
    getItem: vi.fn(),
    saveItem: vi.fn(),
  }
}
