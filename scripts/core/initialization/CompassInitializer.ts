import {
  world,
  system,
  EntityInventoryComponent,
  EntityComponentTypes,
  ItemStack,
  ItemLockMode,
} from "@minecraft/server";
import type { IInitializer } from "./IInitializer";
import type { ICompassNavigationService } from "../features/navigation/ICompassNavigationService";
import type { IMessageProvider } from "../messaging/IMessageProvider";

export class CompassInitializer implements IInitializer {
  constructor(
    private readonly compassService: ICompassNavigationService,
    private readonly messageProvider: IMessageProvider
  ) {}

  public initialize(): void {
    // Give compass on first spawn
    world.afterEvents.playerSpawn.subscribe((event) => {
      if (event.initialSpawn) {
        system.run(() => {
          if (event.player.isValid) {
            this.giveCompass(event.player);
          }
        });
      }
    });

    // Update compass every second for players holding it
    system.runInterval(() => {
      for (const player of world.getAllPlayers()) {
        const inventory = player.getComponent(
          EntityComponentTypes.Inventory
        ) as EntityInventoryComponent;
        const mainhand = inventory?.container?.getItem(player.selectedSlotIndex);

        if (mainhand?.typeId === "minecraft_raids:village_compass") {
          this.compassService.updateCompass(player);
        }
      }
    }, 20); // Every second (20 ticks)
  }

  private giveCompass(player: any): void {
    const inventory = player.getComponent(
      EntityComponentTypes.Inventory
    ) as EntityInventoryComponent;
    if (!inventory?.container) return;

    // Check if player already has compass
    for (let i = 0; i < inventory.container.size; i++) {
      const item = inventory.container.getItem(i);
      if (item?.typeId === "minecraft_raids:village_compass") {
        return; // Already has one
      }
    }

    // Give locked compass
    const compass = new ItemStack("minecraft_raids:village_compass", 1);
    compass.keepOnDeath = true;
    compass.lockMode = ItemLockMode.inventory;
    inventory.container.addItem(compass);

    const receivedMessage = this.messageProvider.getMessage(
      "mc.raids.compass.received",
      "You received a Village Compass!"
    );
    player.sendMessage({
      rawtext: [{ text: "§a" }, receivedMessage],
    });
  }
}
