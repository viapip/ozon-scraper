import { join } from 'node:path'
import process from 'node:process'

import { Level } from 'level'

export class StorageService<T> {
  private db: Level

  constructor(dbName: string) {
    this.db = new Level(join(process.cwd(), dbName), { valueEncoding: 'json' })
  }

  async saveItem(key: string, item: T): Promise<void> {
    await this.db.put(key, JSON.stringify(item))
  }

  async getItem(key: string): Promise<T | null> {
    try {
      const value = await this.db.get(key)

      return JSON.parse(value) as T
    }
    catch {
      return null
    }
  }

  async deleteItem(key: string): Promise<void> {
    await this.db.del(key)
  }

  async clearOldItems(prefix: string, cutoffDate: Date): Promise<void> {
    await this.db.clear({ gte: `${prefix}:${cutoffDate.getTime()}` })
  }

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

  async close(): Promise<void> {
    await this.db.close()
  }
}
