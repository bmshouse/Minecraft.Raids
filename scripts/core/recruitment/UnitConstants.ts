/**
 * Constants for the unit recruitment system.
 */
export class UnitConstants {
  /**
   * Tag prefix for marking unit ownership
   * Format: "owner:<playerId>"
   */
  static readonly OWNER_TAG_PREFIX = "owner:";

  /**
   * Tag identifying raid units (distinguishes from wild mobs)
   */
  static readonly RAID_UNIT_TAG = "raid_unit";

  /**
   * Maximum number of units that can be stored in the pocket
   */
  static readonly MAX_POCKETED_UNITS = 75;

  /**
   * Multiplier for sell price (50% refund when selling units)
   */
  static readonly SELL_PRICE_MULTIPLIER = 0.5;
}
