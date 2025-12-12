import type { RawMessage } from "@minecraft/server";

/**
 * Interface for providing localized messages (i18n)
 * Follows Single Responsibility Principle - focuses only on message retrieval
 * Uses RawMessage to read translations from resource pack .lang files
 */
export interface IMessageProvider {
  /**
   * Retrieves a localized message by key
   * Returns a RawMessage that the client translates based on the .lang file
   * @param key - The message key to look up in the .lang file
   * @param fallback - Optional fallback message if key not found (not typically used with .lang file lookup)
   * @returns RawMessage with translate property pointing to the .lang file key
   */
  getMessage(key: string, fallback?: string): RawMessage;
}
