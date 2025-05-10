import type { User } from '../../types/index'

import { createLogger } from '../../utils/logger'
import { UserRepository } from './repository'

const logger = createLogger('UserService')

/**
 * Service for managing users
 */
export class UserService {
  private repository: UserRepository

  constructor() {
    this.repository = new UserRepository()
  }

  /**
   * Create a new user
   */
  async createUser(chatId: string): Promise<User> {
    try {
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

      await this.repository.saveUser(user)
      logger.info(`Created user ${chatId}`)

      return user
    }
    catch (error) {
      logger.error(`Failed to create user ${chatId}:`, error)
      throw error
    }
  }

  /**
   * Get a user by chat ID
   */
  async getUser(chatId: string): Promise<null | User> {
    return this.repository.getUser(chatId)
  }

  /**
   * Update a user
   */
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

      await this.repository.saveUser(updatedUser)
      logger.info(`Updated user ${chatId}`)

      return updatedUser
    }
    catch (error) {
      logger.error(`Failed to update user ${chatId}:`, error)
      throw error
    }
  }

  /**
   * Update a user's products
   */
  async updateUserProducts(chatId: string, products: string[]): Promise<null | User> {
    return this.updateUser(chatId, { products })
  }

  /**
   * Get a user's products
   */
  async getUserProducts(chatId: string): Promise<string[]> {
    const user = await this.getUser(chatId)

    return user?.products || []
  }

  /**
   * Set a user's active status
   */
  async setActive(chatId: string, isActive: boolean): Promise<null | User> {
    return this.updateUser(chatId, { isActive })
  }

  /**
   * Set a user's favorite list
   */
  async setFavoriteList(chatId: string, listId: string): Promise<null | User> {
    return this.updateUser(chatId, { favoriteListId: listId })
  }

  /**
   * Remove a user's favorite list
   */
  async removeFavoriteList(chatId: string): Promise<null | User> {
    return this.updateUser(chatId, { favoriteListId: undefined })
  }

  /**
   * Delete a user
   */
  async deleteUser(chatId: string): Promise<void> {
    try {
      await this.repository.deleteUser(chatId)
      logger.info(`Deleted user ${chatId}`)
    }
    catch (error) {
      logger.error(`Failed to delete user ${chatId}:`, error)
      throw error
    }
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<User[]> {
    return this.repository.getAllUsers()
  }

  /**
   * Get all active users
   */
  async getActiveUsers(): Promise<User[]> {
    const users = await this.getAllUsers()

    return users.filter((user) => {
      return user.isActive
    })
  }

  /**
   * Close the service
   */
  async close(): Promise<void> {
    await this.repository.close()
  }
}
