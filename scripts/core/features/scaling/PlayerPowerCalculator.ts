import {
  Player,
  EntityComponentTypes,
  EntityEquippableComponent,
  EquipmentSlot,
} from "@minecraft/server";
import { PlayerPower } from "../../GameConstants";
import type { IUnitPocketService } from "../../recruitment/IUnitPocketService";
import type { IPlayerPowerCalculator, PlayerPowerLevel } from "./IPlayerPowerCalculator";

export class PlayerPowerCalculator implements IPlayerPowerCalculator {
  // Equipment scoring constants
  private readonly ARMOR_SCORES = PlayerPower.ARMOR_SCORES;
  private readonly WEAPON_SCORES = PlayerPower.WEAPON_SCORES;

  // Party size thresholds
  private readonly MAX_PARTY_SIZE = PlayerPower.MAX_PARTY_SIZE;

  constructor(private readonly unitPocketService: IUnitPocketService) {}

  /**
   * Calculate player's power level based on equipment and raid party
   */
  public calculatePowerLevel(player: Player): PlayerPowerLevel {
    const equipmentScore = this.calculateEquipmentScore(player);
    const partyScore = this.calculatePartyScore(player);

    // Weighted average: 60% equipment, 40% party
    const totalScore =
      equipmentScore * PlayerPower.EQUIPMENT_WEIGHT + partyScore * PlayerPower.PARTY_WEIGHT;

    return {
      equipmentScore,
      partyScore,
      totalScore,
      tier: this.getTierFromScore(totalScore),
    };
  }

  /**
   * Calculate score from player's equipment (armor + weapon)
   * Returns 0.0 to 1.0
   */
  private calculateEquipmentScore(player: Player): number {
    const equippable = player.getComponent(
      EntityComponentTypes.Equippable
    ) as EntityEquippableComponent;
    if (!equippable) return 0;

    // Check all armor slots
    const armorSlots = [
      EquipmentSlot.Head,
      EquipmentSlot.Chest,
      EquipmentSlot.Legs,
      EquipmentSlot.Feet,
    ];

    let armorScore = 0;
    let armorCount = 0;

    for (const slot of armorSlots) {
      const item = equippable.getEquipment(slot);
      if (item) {
        armorScore += this.getArmorScore(item.typeId);
        armorCount++;
      }
    }

    // Average armor score (0 if no armor)
    const avgArmorScore = armorCount > 0 ? armorScore / 4 : 0;

    // Check weapon (mainhand)
    const weapon = equippable.getEquipment(EquipmentSlot.Mainhand);
    const weaponScore = weapon ? this.getWeaponScore(weapon.typeId) : 0;

    // Enchantment bonus
    const enchantmentBonus = this.hasEnchantments(player) ? PlayerPower.ENCHANTMENT_BONUS : 0;

    // Combine: armor + weapon + enchantments
    return Math.min(
      1.0,
      avgArmorScore * PlayerPower.ARMOR_WEIGHT +
        weaponScore * PlayerPower.WEAPON_WEIGHT +
        enchantmentBonus
    );
  }

  /**
   * Get armor score from item ID
   */
  private getArmorScore(itemId: string): number {
    if (itemId.includes("netherite")) return this.ARMOR_SCORES.NETHERITE;
    if (itemId.includes("diamond")) return this.ARMOR_SCORES.DIAMOND;
    if (itemId.includes("iron")) return this.ARMOR_SCORES.IRON;
    if (itemId.includes("chainmail")) return this.ARMOR_SCORES.CHAINMAIL;
    if (itemId.includes("leather")) return this.ARMOR_SCORES.LEATHER;
    return 0;
  }

  /**
   * Get weapon score from item ID
   */
  private getWeaponScore(itemId: string): number {
    if (!itemId.includes("sword") && !itemId.includes("axe")) return 0.1; // Not a weapon

    if (itemId.includes("netherite")) return this.WEAPON_SCORES.NETHERITE;
    if (itemId.includes("diamond")) return this.WEAPON_SCORES.DIAMOND;
    if (itemId.includes("iron")) return this.WEAPON_SCORES.IRON;
    if (itemId.includes("stone")) return this.WEAPON_SCORES.STONE;
    if (itemId.includes("wooden")) return this.WEAPON_SCORES.WOOD;
    return 0.1;
  }

  /**
   * Check if player has enchanted equipment
   */
  private hasEnchantments(player: Player): boolean {
    const equippable = player.getComponent(
      EntityComponentTypes.Equippable
    ) as EntityEquippableComponent;
    if (!equippable) return false;

    const slots = [
      EquipmentSlot.Head,
      EquipmentSlot.Chest,
      EquipmentSlot.Legs,
      EquipmentSlot.Feet,
      EquipmentSlot.Mainhand,
    ];

    for (const slot of slots) {
      const item = equippable.getEquipment(slot);
      if (item?.hasComponent("minecraft:enchantments")) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate score from raid party size
   * Returns 0.0 to 1.0
   */
  private calculatePartyScore(player: Player): number {
    const activeUnits = this.unitPocketService.getActiveUnits(player);
    const pocketedUnits = this.unitPocketService.getPocketedUnits(player);
    const totalUnits = activeUnits.length + pocketedUnits.length;

    // Scale linearly up to MAX_PARTY_SIZE
    return Math.min(1.0, totalUnits / this.MAX_PARTY_SIZE);
  }

  /**
   * Classify power level into tiers
   */
  private getTierFromScore(score: number): "beginner" | "intermediate" | "advanced" | "expert" {
    if (score < PlayerPower.TIER_THRESHOLDS.BEGINNER) return "beginner";
    if (score < PlayerPower.TIER_THRESHOLDS.INTERMEDIATE) return "intermediate";
    if (score < PlayerPower.TIER_THRESHOLDS.ADVANCED) return "advanced";
    return "expert";
  }
}
