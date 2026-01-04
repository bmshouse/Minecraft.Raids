import {
  Player,
  EntityComponentTypes,
  EntityHealthComponent,
  type RawMessage,
  type Entity,
} from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { WolfStats } from "../GameConstants";
import type { IMessageProvider } from "../messaging/IMessageProvider";
import type { IPlayerBookService } from "./IPlayerBookService";
import type { IResourceService } from "../resources/IResourceService";
import type { IRecruitmentService } from "../recruitment/IRecruitmentService";
import type { IUnitPocketService } from "../recruitment/IUnitPocketService";
import type { IWealthCalculationService } from "./IWealthCalculationService";
import type { IVillageCache } from "./village/IVillageCache";
import type { ConquestTracker } from "./village/ConquestTracker";
import { UnitDefinitions, type UnitDefinition } from "../recruitment/UnitDefinitions";
import { CostFormatter } from "../utils/CostFormatter";
import type { RecruitmentResult } from "../recruitment/IRecruitmentService";
import { DistanceUtils } from "../utils/DistanceUtils";

/**
 * Internal representation of a unit for sell operations
 * Unifies active entities and pocketed data
 */
interface UnifiedUnitReference {
  isActive: boolean; // true = active entity, false = pocketed
  entityRef?: Entity; // For active units
  pocketedIndex?: number; // For pocketed units
  currentHP: number;
  maxHP: number;
  entityId: string;
  displayName: string;
  unitDef: UnitDefinition;
}

/**
 * Service for building and displaying the player book UI
 * Provides table of contents navigation to multiple sections:
 * - Wealth Leaderboard: Shows players ranked by total emerald wealth
 * - Raid Party: Shows tamed wolves and recruited units
 * - Recruit Units: Purchase new units for your army
 * - Manage Army: Sell units from your army
 * - Discovered Villages: Shows all villages found during exploration
 *
 * Follows Single Responsibility Principle - only handles book UI presentation
 */
export class PlayerBookService implements IPlayerBookService {
  constructor(
    private readonly messageProvider: IMessageProvider,
    private readonly resourceService: IResourceService,
    private readonly recruitmentService: IRecruitmentService,
    private readonly unitPocketService: IUnitPocketService,
    private readonly wealthCalculationService: IWealthCalculationService,
    private readonly villageCache: IVillageCache,
    private readonly conquestTracker: ConquestTracker
  ) {}

  /**
   * Main entry point - shows the player book with table of contents
   * @param requestingPlayer - The player who will see the book
   */
  public async showBook(requestingPlayer: Player): Promise<void> {
    await this.showTableOfContents(requestingPlayer);
  }

  /**
   * Shows the table of contents menu with navigation to all sections
   * Routes to appropriate section based on user selection
   */
  private async showTableOfContents(player: Player): Promise<void> {
    // Get current resources to display
    const emeralds = this.resourceService.getEmeralds(player);
    const resourcesText = `Resources: ${emeralds} emeralds\n\n`;

    const bodyText: RawMessage = {
      rawtext: [{ text: resourcesText }, this.messageProvider.getMessage("mc.raids.book.body")],
    };

    const form = new ActionFormData()
      .title(this.messageProvider.getMessage("mc.raids.book.title"))
      .body(bodyText)
      .button(this.messageProvider.getMessage("mc.raids.book.section.leaderboard"))
      .button(this.messageProvider.getMessage("mc.raids.book.section.raidparty"))
      .button(this.messageProvider.getMessage("mc.raids.book.section.recruit"))
      .button(this.messageProvider.getMessage("mc.raids.book.section.managearmy"))
      .button(this.messageProvider.getMessage("mc.raids.book.section.villages"));

    const result = await form.show(player);

    if (!result.canceled && result.selection !== undefined) {
      switch (result.selection) {
        case 0:
          await this.showPlayerListSection(player);
          break;
        case 1:
          await this.showSelectIndividualUnitsMenu(player);
          break;
        case 2:
          await this.showRecruitUnitsSection(player);
          break;
        case 3:
          await this.showManageArmySection(player);
          break;
        case 4:
          await this.showDiscoveredVillagesSection(player);
          break;
      }
    }
  }

  /**
   * Shows the Wealth Leaderboard section
   * Displays all players ranked by total emerald wealth
   */
  private async showPlayerListSection(player: Player): Promise<void> {
    const wealthData = this.wealthCalculationService.calculateAllPlayerWealth();

    const form = new ActionFormData()
      .title(this.messageProvider.getMessage("mc.raids.leaderboard.title"))
      .body(this.messageProvider.getMessage("mc.raids.leaderboard.body"));

    if (wealthData.length === 0) {
      form.body(this.messageProvider.getMessage("mc.raids.leaderboard.noplayers"));
    } else {
      for (let i = 0; i < wealthData.length; i++) {
        const rank = i + 1;
        const data = wealthData[i];
        const totalStr = CostFormatter.formatAbbreviated(data.totalWealth);
        form.button(`#${rank} ${data.playerName} - ${totalStr}`);
      }
    }

    await form.show(player);
    // Note: Clicking a player entry does nothing - leaderboard stays open
    // User must close the form manually
  }

  /**
   * Shows the Recruit Units section
   * Allows players to purchase new units for their army
   */
  private async showRecruitUnitsSection(player: Player): Promise<void> {
    const emeralds = this.resourceService.getEmeralds(player);
    const resourcesText = `Resources: ${emeralds} emeralds\n\n`;

    const bodyText: RawMessage = {
      rawtext: [{ text: resourcesText }, this.messageProvider.getMessage("mc.raids.recruit.body")],
    };

    const form = new ActionFormData()
      .title(this.messageProvider.getMessage("mc.raids.recruit.title"))
      .body(bodyText);

    // Add a button for each unit type
    const units = UnitDefinitions.getAllUnits();
    for (const unit of units) {
      const costStr = CostFormatter.formatAbbreviated(unit.cost);
      const buttonText = `${unit.displayName} - ${costStr}\n${unit.description}`;
      form.button(buttonText);
    }

    const result = await form.show(player);

    if (!result.canceled && result.selection !== undefined) {
      const selectedUnit = units[result.selection];
      const recruitResult = this.recruitmentService.recruitUnit(player, selectedUnit);

      // Show result message
      player.sendMessage(recruitResult.message);

      // Return to recruit units section (recursive)
      await this.showRecruitUnitsSection(player);
    }
    // If canceled, just return (form already closed)
  }

  /**
   * Shows the Manage Army section
   * Allows players to sell units (both active and pocketed) for a 50% refund
   * Automatically sells lowest HP unit of selected type
   */
  private async showManageArmySection(player: Player): Promise<void> {
    const unitsByType = this.combineUnitsForSelling(player);

    if (unitsByType.size === 0) {
      const form = new ActionFormData()
        .title(this.messageProvider.getMessage("mc.raids.managearmy.title"))
        .body(this.messageProvider.getMessage("mc.raids.managearmy.nounits"));

      await form.show(player);
      await this.showTableOfContents(player);
      return;
    }

    // Build form with combined counts
    const form = new ActionFormData()
      .title(this.messageProvider.getMessage("mc.raids.managearmy.title"))
      .body(this.messageProvider.getMessage("mc.raids.managearmy.body"));

    const typeEntries = Array.from(unitsByType.entries());
    for (const [_groupKey, unitsOfType] of typeEntries) {
      const firstUnit = unitsOfType[0];
      const totalCount = unitsOfType.length;
      const sellPrice = UnitDefinitions.getSellPrice(firstUnit.unitDef);
      const sellPriceStr = CostFormatter.formatAbbreviated(sellPrice);

      form.button(`${firstUnit.displayName} (Owned: ${totalCount}) - Sell for ${sellPriceStr}`);
    }

    const result = await form.show(player);

    if (!result.canceled && result.selection !== undefined) {
      const [_groupKey, unitsOfType] = typeEntries[result.selection];

      // Find and sell lowest HP unit
      const lowestHPUnit = this.findLowestHPUnit(unitsOfType);

      let sellResult: RecruitmentResult;
      if (lowestHPUnit.isActive) {
        // Active unit - use recruitmentService
        sellResult = this.recruitmentService.sellUnit(player, lowestHPUnit.entityRef!);

        // Attempt replacement with pocketed unit of same type
        await this.attemptUnitReplacement(player, lowestHPUnit);
      } else {
        // Pocketed unit - use custom logic
        sellResult = this.sellPocketedUnit(
          player,
          lowestHPUnit.pocketedIndex!,
          lowestHPUnit.unitDef
        );
      }

      // Show result message
      player.sendMessage(sellResult.message);

      // Return to manage army section (recursive)
      await this.showManageArmySection(player);
    } else {
      // Canceled - return to table of contents
      await this.showTableOfContents(player);
    }
  }

  /**
   * Shows individual unit selection menu
   * Uses ModalFormData with toggles to pocket/release multiple units at once
   * Includes "Pocket All" and "Release All" toggles at the top
   * Reopens after submission to allow continuous management
   */
  private async showSelectIndividualUnitsMenu(player: Player): Promise<void> {
    const activeUnits = this.unitPocketService.getActiveUnits(player);
    const pocketedUnits = this.unitPocketService.getPocketedUnits(player);

    if (activeUnits.length === 0 && pocketedUnits.length === 0) {
      player.sendMessage(
        this.messageProvider.getMessage("mc.raids.pocket.nounits").text || "You have no raid units!"
      );
      // Return to table of contents
      await this.showTableOfContents(player);
      return;
    }

    const form = new ModalFormData().title(
      this.messageProvider.getMessage("mc.raids.pocket.title")
    );

    // Track toggle indices
    let toggleIndex = 0;
    let pocketAllIndex = -1;
    let releaseAllIndex = -1;

    // Add "Pocket All" toggle if there are active units
    if (activeUnits.length > 0) {
      pocketAllIndex = toggleIndex++;
      form.toggle(`§6Pocket All (${activeUnits.length} units)§r`);
    }

    // Add "Release All" toggle if there are pocketed units
    if (pocketedUnits.length > 0) {
      releaseAllIndex = toggleIndex++;
      form.toggle(`§6Release All (${pocketedUnits.length} units)§r`);
    }

    // Track entities for processing
    const entities: Array<{ entity: Entity; displayName: string }> = [];
    const pocketedIndices: number[] = [];
    const activeUnitsStartIndex = toggleIndex;

    // Add toggles for active units (checked = pocket)
    for (const unit of activeUnits) {
      const health = unit.getComponent(EntityComponentTypes.Health) as
        | EntityHealthComponent
        | undefined;
      const currentHP = Math.round(health?.currentValue ?? 0);
      const maxHP = Math.round(health?.defaultValue ?? WolfStats.GUARD_HP);
      const unitDef = UnitDefinitions.getByEntityIdAndHealth(unit.typeId, maxHP);
      const displayName = unitDef?.displayName ?? unit.typeId;

      entities.push({ entity: unit, displayName });
      form.toggle(`[Active] ${displayName} - HP: ${currentHP}/${maxHP}`);
      toggleIndex++;
    }

    const pocketedUnitsStartIndex = toggleIndex;

    // Add toggles for pocketed units (checked = release)
    for (let i = 0; i < pocketedUnits.length; i++) {
      const unit = pocketedUnits[i];
      pocketedIndices.push(i);
      form.toggle(`[Pocketed] ${unit.displayName} - HP: ${unit.currentHP}/${unit.maxHP}`);
      toggleIndex++;
    }

    const result = await form.show(player);

    if (result.canceled) {
      // Return to table of contents
      await this.showTableOfContents(player);
      return;
    }

    if (result.formValues) {
      let pocketedCount = 0;
      let releasedCount = 0;

      const pocketAllChecked = pocketAllIndex !== -1 && result.formValues[pocketAllIndex];
      const releaseAllChecked = releaseAllIndex !== -1 && result.formValues[releaseAllIndex];

      // Check if BOTH toggles are enabled - perform team swap
      if (pocketAllChecked && releaseAllChecked) {
        // Store counts before operations
        const originalActiveCount = activeUnits.length;
        const originalPocketedCount = pocketedUnits.length;

        // Step 1: Pocket all current active units
        const pocketResult = this.unitPocketService.pocketAllUnits(player);

        // Step 2: Release the originally pocketed units (now at indices 0 to originalPocketedCount-1)
        let releasedCount = 0;
        const errors: string[] = [];
        for (let i = originalPocketedCount - 1; i >= 0; i--) {
          const releaseResult = this.unitPocketService.releaseUnit(player, i);
          if (releaseResult.success) {
            releasedCount++;
          } else {
            // Convert RawMessage to string for error display
            const errorText =
              releaseResult.message.text || releaseResult.message.translate || "Unknown error";
            errors.push(errorText);
          }
        }

        // Show combined message
        const messages: string[] = [];
        if (pocketResult.success && pocketResult.count > 0) {
          messages.push(`§aPocketed ${originalActiveCount} unit(s)`);
        }
        if (releasedCount > 0) {
          messages.push(`§aReleased ${releasedCount} unit(s)`);
        }
        if (messages.length > 0) {
          const teamSwapMsg = this.messageProvider.getMessage("mc.raids.unit.team_swap");
          player.sendMessage(messages.join(", ") + teamSwapMsg.text);
        }
        if (errors.length > 0) {
          const errorMsg = this.messageProvider.getMessage(
            "mc.raids.unit.release_failed",
            errors.join(", ")
          );
          player.sendMessage(errorMsg);
        }

        // Reopen menu after team swap
        await this.showSelectIndividualUnitsMenu(player);
        return;
      }

      // Check "Pocket All" toggle only
      if (pocketAllChecked) {
        const pocketResult = this.unitPocketService.pocketAllUnits(player);
        player.sendMessage({
          rawtext: [{ text: pocketResult.success ? "§a" : "§c" }, pocketResult.message],
        });
        // Reopen menu after pocketing all
        await this.showSelectIndividualUnitsMenu(player);
        return;
      }

      // Check "Release All" toggle only
      if (releaseAllChecked) {
        const releaseResult = this.unitPocketService.releaseAllUnits(player);
        player.sendMessage({
          rawtext: [{ text: releaseResult.success ? "§a" : "§c" }, releaseResult.message],
        });
        // Reopen menu after releasing all
        await this.showSelectIndividualUnitsMenu(player);
        return;
      }

      // Process active units (toggle = pocket)
      for (let i = 0; i < activeUnits.length; i++) {
        const toggled = result.formValues[activeUnitsStartIndex + i] as boolean;
        if (toggled) {
          const pocketResult = this.unitPocketService.pocketUnit(player, entities[i].entity);
          if (pocketResult.success) {
            pocketedCount++;
          } else {
            player.sendMessage({
              rawtext: [{ text: "§c" }, pocketResult.message],
            });
          }
        }
      }

      // Process pocketed units (toggle = release) in reverse order
      const releaseIndices: number[] = [];
      for (let i = 0; i < pocketedUnits.length; i++) {
        const toggled = result.formValues[pocketedUnitsStartIndex + i] as boolean;
        if (toggled) {
          releaseIndices.push(pocketedIndices[i]);
        }
      }

      // Release in reverse order to maintain indices
      releaseIndices.sort((a, b) => b - a);
      for (const index of releaseIndices) {
        const releaseResult = this.unitPocketService.releaseUnit(player, index);
        if (releaseResult.success) {
          releasedCount++;
        } else {
          player.sendMessage({
            rawtext: [{ text: "§c" }, releaseResult.message],
          });
        }
      }

      // Show summary message
      if (pocketedCount > 0 || releasedCount > 0) {
        const messages: string[] = [];
        if (pocketedCount > 0) {
          messages.push(`§aPocketed ${pocketedCount} unit(s)`);
        }
        if (releasedCount > 0) {
          messages.push(`§aReleased ${releasedCount} unit(s)`);
        }
        player.sendMessage(messages.join(", "));
        // Reopen menu after individual toggles
        await this.showSelectIndividualUnitsMenu(player);
        return;
      }
    }

    // Return to table of contents
    await this.showTableOfContents(player);
    return;
  }

  /**
   * Combine active and pocketed units into unified representation
   * Groups by type (considering wolf specializations by max HP)
   */
  private combineUnitsForSelling(player: Player): Map<string, UnifiedUnitReference[]> {
    const unitsByType = new Map<string, UnifiedUnitReference[]>();

    // Get active units
    const activeUnits = this.recruitmentService.getPlayerUnits(player);
    for (const entity of activeUnits) {
      const health = entity.getComponent(EntityComponentTypes.Health) as
        | EntityHealthComponent
        | undefined;
      const currentHP = Math.round(health?.currentValue ?? 0);
      const maxHP = Math.round(health?.defaultValue ?? WolfStats.GUARD_HP);

      const unitDef = UnitDefinitions.getByEntityIdAndHealth(entity.typeId, maxHP);
      if (!unitDef) continue;

      // Group wolves by specialization (using maxHP), others by entityId
      const groupKey =
        entity.typeId === "minecraft:wolf" ? `${entity.typeId}_${maxHP}` : entity.typeId;

      if (!unitsByType.has(groupKey)) {
        unitsByType.set(groupKey, []);
      }

      unitsByType.get(groupKey)!.push({
        isActive: true,
        entityRef: entity,
        currentHP,
        maxHP,
        entityId: entity.typeId,
        displayName: unitDef.displayName,
        unitDef,
      });
    }

    // Get pocketed units
    const pocketedUnits = this.unitPocketService.getPocketedUnits(player);
    for (let i = 0; i < pocketedUnits.length; i++) {
      const unit = pocketedUnits[i];
      const unitDef = UnitDefinitions.getByEntityIdAndHealth(unit.entityId, unit.maxHP);
      if (!unitDef) continue;

      const groupKey =
        unit.entityId === "minecraft:wolf" ? `${unit.entityId}_${unit.maxHP}` : unit.entityId;

      if (!unitsByType.has(groupKey)) {
        unitsByType.set(groupKey, []);
      }

      unitsByType.get(groupKey)!.push({
        isActive: false,
        pocketedIndex: i,
        currentHP: unit.currentHP,
        maxHP: unit.maxHP,
        entityId: unit.entityId,
        displayName: unit.displayName,
        unitDef,
      });
    }

    return unitsByType;
  }

  /**
   * Find unit with lowest current HP
   */
  private findLowestHPUnit(units: UnifiedUnitReference[]): UnifiedUnitReference {
    return units.reduce((lowest, current) =>
      current.currentHP < lowest.currentHP ? current : lowest
    );
  }

  /**
   * Sell a pocketed unit (can't use recruitmentService.sellUnit for despawned units)
   */
  private sellPocketedUnit(
    player: Player,
    pocketedIndex: number,
    unitDef: UnitDefinition
  ): RecruitmentResult {
    try {
      // Calculate refund
      const sellPrice = UnitDefinitions.getSellPrice(unitDef);

      // Give refund
      this.resourceService.addEmeralds(player, sellPrice);

      // Remove from pocket
      const removed = this.unitPocketService.removePocketedUnit(player, pocketedIndex);

      if (!removed) {
        return {
          success: false,
          message: this.messageProvider.getMessage("mc.raids.unit.remove_failed"),
        };
      }

      const sellPriceMsg = this.messageProvider.getMessage(
        "mc.raids.unit.sell_price",
        sellPrice.toString()
      );
      return {
        success: true,
        message: {
          rawtext: [
            { text: "§a" },
            { translate: "mc.raids.managearmy.sold" },
            { text: ` ${unitDef.displayName} ${sellPriceMsg.text}` },
          ],
        },
      };
    } catch (error) {
      return {
        success: false,
        message: { text: `§cFailed to sell pocketed unit: ${error}` },
      };
    }
  }

  /**
   * Attempt to replace sold active unit with pocketed unit of same type
   */
  private async attemptUnitReplacement(
    player: Player,
    soldUnitRef: UnifiedUnitReference
  ): Promise<void> {
    // Only replace if sold unit was active
    if (!soldUnitRef.isActive) return;

    // Find matching pocketed unit (same entityId and maxHP)
    const pocketedUnits = this.unitPocketService.getPocketedUnits(player);
    const matchIndex = pocketedUnits.findIndex(
      (u) => u.entityId === soldUnitRef.entityId && u.maxHP === soldUnitRef.maxHP
    );

    if (matchIndex === -1) return; // No matching pocketed unit

    // Attempt to release
    const result = this.unitPocketService.releaseUnit(player, matchIndex);

    if (result.success) {
      player.sendMessage({
        rawtext: [{ text: "§a" }, { translate: "mc.raids.managearmy.replacement.success" }],
      });
    } else {
      // Spawn failed - complete sale but leave unit pocketed
      player.sendMessage({
        rawtext: [{ text: "§e" }, { translate: "mc.raids.managearmy.replacement.failed" }],
      });
    }
  }

  /**
   * Shows the Discovered Villages section
   * Displays all villages found during exploration with status and distance
   */
  private async showDiscoveredVillagesSection(player: Player): Promise<void> {
    const allVillages = this.villageCache.getDiscoveredVillages();

    const form = new ActionFormData()
      .title(this.messageProvider.getMessage("mc.raids.book.villages.title"))
      .body(
        this.messageProvider.getMessage(
          "mc.raids.book.villages.body",
          allVillages.length.toString()
        )
      );

    if (allVillages.length === 0) {
      form.body(this.messageProvider.getMessage("mc.raids.book.villages.none"));
    } else {
      // Sort villages by distance from player
      const villagesWithDistance = allVillages.map((village) => {
        const distance = DistanceUtils.calculateHorizontalDistance(
          player.location,
          village.location
        );
        return { village, distance };
      });

      villagesWithDistance.sort((a, b) => a.distance - b.distance);

      // Display each village with status
      for (const { village, distance } of villagesWithDistance) {
        const canConquer = this.conquestTracker.canConquer(player.id, village.key);
        const status = canConquer
          ? this.messageProvider.getMessage("mc.raids.book.villages.ready")
          : this.messageProvider.getMessage("mc.raids.book.villages.cooldown");

        const distanceText = Math.round(distance);
        const buttonText = `${status} - ${distanceText}m away`;
        form.button(buttonText);
      }
    }

    await form.show(player);
    // Note: Clicking a village entry does nothing - list stays open
    // User must close the form manually
  }
}
