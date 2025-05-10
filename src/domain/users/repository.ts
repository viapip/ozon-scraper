import { createLogger } from '../../utils/logger.js'
import { LevelDBStorage } from '../../infrastructure/storage/index.js'
import type { User } from '../../types/index.js'

const logger = createLogger('UserRepository')

/**
 * Repository for managing user data storage
 */
export class UserRepository {
  private static readonly USER_PREFIX = 'user:'
  private readonly storage

  constructor() {
    this.storage = new LevelDBStorage<User>('users')
  }

  /**
   * Get a user by chat ID
   */
  async getUser(chatId: string): Promise<null | User> {
    try {
      return await this.storage.getItem(this.getUserKey(chatId))
    }
    catch {
      return null
    }
  }

  /**
   * Save a user
   */
  async saveUser(user: User): Promise<void> {
    await this.storage.saveItem(this.getUserKey(user.chatId), user)
  }

  /**
   * Delete a user
   */
  async deleteUser(chatId: string): Promise<void> {
    await this.storage.deleteItem(this.getUserKey(chatId))
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<User[]> {
    try {
      return await this.storage.getAllItems(UserRepository.USER_PREFIX) as User[]
    }
    catch (error) {
      logger.error('Failed to get all users:', error)

      return []
    }
  }

  /**
   * Close the repository connection
   */
  async close(): Promise<void> {
    await this.storage.close()
  }

  /**
   * Get a user key
   */
  private getUserKey(chatId: string): string {
    return `${UserRepository.USER_PREFIX}${chatId}`
  }
}
