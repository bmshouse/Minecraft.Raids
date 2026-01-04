/**
 * Mock implementation of @minecraft/server for unit testing
 * Only includes minimal types and interfaces needed for tests
 */

// Mock Player interface
export interface Player {
  name: string;
  id: string;
}

// Mock Entity interface
export interface Entity {
  typeId: string;
  id: string;
  getComponent(componentId: string): any;
  triggerEvent?(eventName: string): void;
}

// Mock EntityHealthComponent
export interface EntityHealthComponent {
  readonly currentValue: number;
  readonly defaultValue: number;
  readonly effectiveMax: number;
  readonly effectiveMin: number;
  setCurrentValue(value: number): void;
}

// Mock world object
export const world = {
  getAllPlayers: (): Player[] => [],
  getPlayers: (): Player[] => [],
};

// Mock EntityComponentTypes
export const EntityComponentTypes = {
  Health: "minecraft:health",
  Tameable: "minecraft:tameable",
  Inventory: "minecraft:inventory",
  Equippable: "minecraft:equippable",
};

// Mock EquipmentSlot enum
export const EquipmentSlot = {
  Head: "Head",
  Chest: "Chest",
  Legs: "Legs",
  Feet: "Feet",
  Mainhand: "Mainhand",
  Offhand: "Offhand",
};

// Mock system object
export const system = {
  beforeEvents: {
    playerSpawn: {
      subscribe: (_callback: any) => {},
    },
  },
  afterEvents: {
    entityDie: {
      subscribe: (_callback: any) => {},
    },
  },
  runInterval: (_callback: any, _tickInterval: number) => 0,
  runTimeout: (_callback: any, _tickDelay: number) => 0,
  clearRun: (_runId: number) => {},
};

// Re-export everything
export default {
  world,
  EntityComponentTypes,
  system,
};
