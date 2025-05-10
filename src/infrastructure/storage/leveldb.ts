import { join } from 'node:path'
import { Level } from 'level'
import { config } from '../../config/index'

interface StorageOptions {
  basePath?: string
  valueEncoding?: string
}

/**
 * LevelDB implementation of the storage repository
 */
export class LevelDBStorage<T> {
  private readonly basePath: string
  private db: Level

  constructor(dbName: string, options: StorageOptions = {}) {
    this.basePath = options.basePath || config.database.path
    this.db = new Level(join(this.basePath, dbName), {
      valueEncoding: options.valueEncoding || 'json',
    })
  }

  /**
   * Save an item to the database
   */
  async saveItem(key: string, item: T): Promise<void> {
    await this.db.put(key, JSON.stringify(item))
  }

  /**
   * Get an item from the database
   */
  async getItem(key: string): Promise<null | T> {
    try {
      const value = await this.db.get(key)

      return JSON.parse(value) as T
    }
    catch {
      return null
    }
  }

  /**
   * Delete an item from the database
   */
  async deleteItem(key: string): Promise<void> {
    try {
      await this.db.del(key)
    }
    catch {
      // Ignore if key doesn't exist
    }
  }

  /**
   * Clear items with keys that match a prefix and are older than a cutoff date
   */
  async clearOldItems(prefix: string, cutoffDate: Date): Promise<void> {
    await this.db.clear({ gte: `${prefix}:${cutoffDate.getTime()}` })
  }

  /**
   * Get all keys that match a prefix
   */
  async getAllKeys(prefix: string): Promise<string[]> {
    const keys: string[] = []
    for await (const [key] of this.db.iterator({
      gte: `${prefix}`,
    })) {
      if (key.startsWith(`${prefix}`)) {
        keys.push(key)
      }
    }

    return keys
  }

  /**
   * Get all items that match a prefix
   */
  async getAllItems(prefix: string): Promise<T[]> {
    const items: T[] = []
    for await (const [key, value] of this.db.iterator({
      gte: `${prefix}`,
    })) {
      if (key.startsWith(`${prefix}`)) {
        try {
          items.push(JSON.parse(value) as T)
        }
        catch (error) {
          console.error(`Failed to parse value for key ${key}:`, error)
        }
      }
    }

    return items
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    await this.db.close()
  }
}
