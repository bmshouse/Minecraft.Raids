/**
 * Utility for formatting emerald costs in different formats.
 */
export class CostFormatter {
  /**
   * Format cost in abbreviated form (e.g., "10E")
   * Used in UI displays where space is limited.
   * @param cost - Emerald cost to format
   * @returns Abbreviated cost string
   */
  public static formatAbbreviated(cost: number): string {
    return `${cost}E`;
  }

  /**
   * Format cost in verbose form (e.g., "10 emeralds")
   * Used in user-facing messages and error feedback.
   * @param cost - Emerald cost to format
   * @returns Verbose cost string
   */
  public static formatVerbose(cost: number): string {
    return `${cost} emeralds`;
  }
}
