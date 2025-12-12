import type { RawMessage } from "@minecraft/server";
import { IMessageProvider } from "./IMessageProvider";

/**
 * Default implementation of IMessageProvider
 * Provides localized messages by reading from resource pack .lang files
 * Follows Single Responsibility Principle - only handles message retrieval
 *
 * The message system uses Minecraft's RawMessage with translate property
 * to read translations from resource_packs/MinecraftRaids/texts/en_US.lang
 * This eliminates duplicate hardcoded messages and allows easy i18n
 */
export class MessageProvider implements IMessageProvider {
  /**
   * Runtime message overrides (optional)
   * Allows dynamic message changes via setMessage()
   * If a key has an override, it's used instead of .lang file lookup
   */
  private readonly messageOverrides: Record<string, string> = {};

  /**
   * Retrieves a localized message by key
   * Returns a RawMessage that Minecraft translates based on the .lang file
   *
   * Flow:
   * 1. Check if there's a runtime override for this key
   * 2. If yes, return it as literal text (RawMessage with text property)
   * 3. If no, return RawMessage with translate property
   *    - Minecraft client looks up the key in .lang file based on player's language
   *    - If key not found, displays the key itself as fallback
   *
   * @param key - The message key to look up in the .lang file
   * @param _fallback - Not used; kept for interface compatibility. .lang file handles fallback via key display.
   * @returns RawMessage that the client translates
   */
  public getMessage(key: string, _fallback?: string): RawMessage {
    // Check if there's a runtime override for this key
    if (this.messageOverrides[key]) {
      return { text: this.messageOverrides[key] };
    }

    // Use .lang file translation
    // The translate property tells Minecraft to look up this key in the .lang file
    return { translate: key };
  }

  /**
   * Sets a runtime override for a message
   * Allows dynamic message changes without modifying the .lang file
   * Useful for testing or runtime customization
   * @param key - The message key
   * @param message - The message text to use instead of .lang file
   */
  public setMessage(key: string, message: string): void {
    this.messageOverrides[key] = message;
  }
}
