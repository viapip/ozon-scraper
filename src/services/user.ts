import { StorageService } from './storage.js'

import type { User } from '../types/index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('UserService')

export class UserService {
  private static readonly USER_PREFIX = 'user:'
  private readonly storageService: StorageService<User>

  constructor() {
    this.storageService = new StorageService<User>('db/users')
  }

  private getUserKey(chatId: string): string {
    return `${UserService.USER_PREFIX}${chatId}`
  }

  async createUser(chatId: string): Promise<User> {
    try {
      const key = this.getUserKey(chatId)
      const existingUser = await this.getUser(chatId)

      if (existingUser) {
        logger.warn(`User ${chatId} already exists`)

        return existingUser
      }

      const user: User = {
        chatId,
        createdAt: Date.now(),
        isActive: false,
        lastActivityAt: Date.now(),
        products: [],
      }

      await this.storageService.saveItem(key, user)
      logger.info(`Created user ${chatId}`)

      return user
    }
    catch (error) {
      logger.error(`Failed to create user ${chatId}:`, error)
      throw error
    }
  }

  async getUser(chatId: string): Promise<null | User> {
    try {
      const key = this.getUserKey(chatId)
      const user = await this.storageService.getItem(key)

      return user || null
    }
    catch {
      return null
    }
  }

  async updateUser(chatId: string, updates: Partial<User>): Promise<null | User> {
    try {
      const user = await this.getUser(chatId)
      if (!user) {
        logger.warn(`User ${chatId} not found`)

        return null
      }

      const updatedUser: User = {
        ...user,
        ...updates,
        lastActivityAt: Date.now(),
      }

      const key = this.getUserKey(chatId)
      await this.storageService.saveItem(key, updatedUser)
      logger.info(`Updated user ${chatId}`)

      return updatedUser
    }
    catch (error) {
      logger.error(`Failed to update user ${chatId}:`, error)
      throw error
    }
  }

  async updateUserProducts(chatId: string, products: string[]): Promise<null | User> {
    return this.updateUser(chatId, { products })
  }

  async getUserProducts(chatId: string): Promise<string[]> {
    const user = await this.getUser(chatId)

    return user?.products || []
  }

  async setActive(chatId: string, isActive: boolean): Promise<null | User> {
    return this.updateUser(chatId, { isActive })
  }

  async setFavoriteList(chatId: string, listId: string): Promise<null | User> {
    return this.updateUser(chatId, { favoriteListId: listId })
  }

  async removeFavoriteList(chatId: string): Promise<null | User> {
    return this.updateUser(chatId, { favoriteListId: undefined })
  }

  async deleteUser(chatId: string): Promise<void> {
    try {
      const key = this.getUserKey(chatId)
      await this.storageService.deleteItem(key)
      logger.info(`Deleted user ${chatId}`)
    }
    catch (error) {
      logger.error(`Failed to delete user ${chatId}:`, error)
      throw error
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const keys = await this.storageService.getAllKeys(UserService.USER_PREFIX)
      const usersPromises = keys.map(async (key) => {
        const user = await this.storageService.getItem(key)

        return user
      })

      return (await Promise.all(usersPromises)).filter((user): user is User => {
        return user !== null
      })
    }
    catch (error) {
      logger.error('Failed to get all users:', error)

      return []
    }
  }
}
