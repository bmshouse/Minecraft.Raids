# Distance-Based Village Defense System

## Overview
Implement a system that automatically enhances villages with defensive structures and guards based on their distance from world spawn. Villages close to spawn remain normal, while distant villages receive progressive protection including walls, extra iron golems, and pillager guards.

## User Requirements
- **Close to spawn** (0-500 blocks): Normal villages, no modifications
- **Medium distance** (500-1000 blocks): Add 2-3 extra iron golems
- **Far distance** (1000-2000 blocks): Add walls + 4-5 iron golems
- **Very far** (2000+ blocks): Full defenses with walls, 6+ iron golems, and pillager guards

## Key Finding: Cannot Modify Villages During World Generation

**From Reference Research:**
- Vanilla villages **CANNOT** be modified during world generation (legacy system)
- Custom jigsaw structures don't integrate with vanilla villages
- No "structure generated" event exists in the scripting API

**Solution:** Use **runtime detection and enhancement** via scripts when villages are discovered.

## Recommended Implementation Approach

### **Runtime Enhancement System**
Detect villages when they generate (via villager spawns), calculate distance from spawn, and dynamically add defenses based on distance tiers.

### Architecture Components

1. **VillageDefenseInitializer** (implements `IInitializer`)
   - Subscribes to `world.afterEvents.entitySpawn` to detect villages
   - Tracks enhanced villages to prevent duplicate enhancements
   - Delegates defense placement to VillageDefenseService

2. **VillageDefenseService** (new service class)
   - Calculates distance from spawn
   - Determines defense tier based on distance
   - Places walls using block placement
   - Spawns iron golems and pillagers
   - Uses structure manager for complex wall structures

3. **IVillageDefenseService** (interface for DI)
   - `enhanceVillage(location: Vector3): Promise<void>`

4. **VillageTracker** (state management)
   - Stores enhanced village locations
   - Prevents duplicate enhancements
   - Persists across world sessions (dynamic properties)

## Available APIs from Research

### Distance Calculation
```typescript
import { Vector3Utils } from "@minecraft/math";

const spawnLoc = world.getDefaultSpawnLocation();
const distance = Vector3Utils.distance(villageLocation, spawnLoc);
```

### Entity Spawning
```typescript
const dimension = world.getDimension("overworld");

// Spawn iron golem
const golem = dimension.spawnEntity("minecraft:iron_golem", location);

// Spawn pillager with patrol behavior
const pillager = dimension.spawnEntity("minecraft:pillager", location);
```

### Block Placement (Walls)
```typescript
// Place stone blocks in a line (wall segment)
for (let y = 0; y < wallHeight; y++) {
  for (let x = 0; x < wallLength; x++) {
    const block = dimension.getBlock({
      x: baseX + x,
      y: baseY + y,
      z: baseZ
    });
    block?.setPermutation(BlockPermutation.resolve("minecraft:stone_bricks"));
  }
}
```

### Structure Placement (Pre-built Walls)
```typescript
// Place pre-built wall structure
world.structureManager.place(
  "minecraft_raids:village_wall_north",
  dimension,
  location
);
```

### Village Detection Pattern
```typescript
world.afterEvents.entitySpawn.subscribe((event) => {
  if (event.entity.typeId === "minecraft:villager") {
    // Village detected at this location
    const villageCenter = event.entity.location;
    enhanceVillage(villageCenter);
  }
});
```

## Defense Tiers

### Tier 0: Normal (0-500 blocks)
- **No modifications**
- Vanilla village remains untouched

### Tier 1: Light Defense (500-1000 blocks)
- **2-3 Iron Golems** spawned around village perimeter
- Positioned at cardinal directions for patrol coverage

### Tier 2: Medium Defense (1000-2000 blocks)
- **4-5 Iron Golems** with patrol behavior
- **Low stone brick walls** (2-3 blocks high) at village entrances
- Walls have gaps for player/villager passage

### Tier 3: Heavy Defense (2000+ blocks)
- **6+ Iron Golems** distributed around perimeter
- **Full perimeter walls** (4-5 blocks high) with cobblestone/stone bricks
- **Watchtowers** at corners (via structure placement)
- **2-3 Pillager guards** with custom AI (friendly to villagers, hostile to raiders)

## Implementation Files

### 1. `scripts/core/features/village/IVillageDefenseService.ts` (NEW)
```typescript
import { Vector3 } from "@minecraft/server";

export interface IVillageDefenseService {
  /**
   * Enhances a village with defenses based on distance from spawn
   * @param villageLocation - Center of the village
   */
  enhanceVillage(villageLocation: Vector3): Promise<void>;

  /**
   * Checks if a village has already been enhanced
   * @param villageLocation - Center of the village
   */
  isVillageEnhanced(villageLocation: Vector3): boolean;
}
```

### 2. `scripts/core/features/village/VillageDefenseService.ts` (NEW)
```typescript
import { world, Vector3, Dimension, BlockPermutation } from "@minecraft/server";
import { Vector3Utils } from "@minecraft/math";
import type { IVillageDefenseService } from "./IVillageDefenseService";

enum DefenseTier {
  None = 0,      // 0-500 blocks
  Light = 1,     // 500-1000 blocks
  Medium = 2,    // 1000-2000 blocks
  Heavy = 3      // 2000+ blocks
}

export class VillageDefenseService implements IVillageDefenseService {
  private enhancedVillages: Set<string> = new Set();
  private readonly VILLAGE_RADIUS = 50; // Blocks from center to edge

  public async enhanceVillage(villageLocation: Vector3): Promise<void> {
    // Check if already enhanced
    if (this.isVillageEnhanced(villageLocation)) {
      return;
    }

    // Calculate distance from spawn
    const spawnLoc = world.getDefaultSpawnLocation();
    const distance = Vector3Utils.distance(villageLocation, spawnLoc);

    // Determine defense tier
    const tier = this.getDefenseTier(distance);

    if (tier === DefenseTier.None) {
      return; // No enhancements for close villages
    }

    // Apply defenses based on tier
    const dimension = world.getDimension("overworld");

    switch (tier) {
      case DefenseTier.Light:
        this.addLightDefense(dimension, villageLocation);
        break;
      case DefenseTier.Medium:
        this.addMediumDefense(dimension, villageLocation);
        break;
      case DefenseTier.Heavy:
        this.addHeavyDefense(dimension, villageLocation);
        break;
    }

    // Mark as enhanced
    this.markVillageEnhanced(villageLocation);
  }

  public isVillageEnhanced(location: Vector3): boolean {
    const key = this.getLocationKey(location);
    return this.enhancedVillages.has(key);
  }

  private getDefenseTier(distance: number): DefenseTier {
    if (distance < 500) return DefenseTier.None;
    if (distance < 1000) return DefenseTier.Light;
    if (distance < 2000) return DefenseTier.Medium;
    return DefenseTier.Heavy;
  }

  private addLightDefense(dimension: Dimension, center: Vector3): void {
    // Spawn 2-3 iron golems at cardinal directions
    const golemPositions = [
      { x: center.x + 20, y: center.y, z: center.z },      // East
      { x: center.x - 20, y: center.y, z: center.z },      // West
      { x: center.x, y: center.y, z: center.z + 20 },      // South
    ];

    golemPositions.forEach(pos => {
      dimension.spawnEntity("minecraft:iron_golem", pos);
    });
  }

  private addMediumDefense(dimension: Dimension, center: Vector3): void {
    // Spawn 4-5 iron golems
    const golemPositions = [
      { x: center.x + 25, y: center.y, z: center.z },
      { x: center.x - 25, y: center.y, z: center.z },
      { x: center.x, y: center.y, z: center.z + 25 },
      { x: center.x, y: center.y, z: center.z - 25 },
      { x: center.x + 18, y: center.y, z: center.z + 18 }, // Diagonal
    ];

    golemPositions.forEach(pos => {
      dimension.spawnEntity("minecraft:iron_golem", pos);
    });

    // Build low walls at entrances (North/South/East/West)
    this.buildWallSegment(dimension, center.x - 10, center.y, center.z + 30, 20, 3, "x");
    this.buildWallSegment(dimension, center.x - 10, center.y, center.z - 30, 20, 3, "x");
  }

  private addHeavyDefense(dimension: Dimension, center: Vector3): void {
    // Spawn 6+ iron golems
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const x = center.x + Math.cos(angle) * 30;
      const z = center.z + Math.sin(angle) * 30;
      dimension.spawnEntity("minecraft:iron_golem", { x, y: center.y, z });
    }

    // Build full perimeter walls
    this.buildPerimeterWall(dimension, center, this.VILLAGE_RADIUS, 5);

    // Spawn friendly pillager guards
    for (let i = 0; i < 3; i++) {
      const angle = (Math.PI * 2 * i) / 3;
      const x = center.x + Math.cos(angle) * 25;
      const z = center.z + Math.sin(angle) * 25;

      const pillager = dimension.spawnEntity("minecraft:pillager", { x, y: center.y, z });
      // TODO: Apply custom component to make friendly to villagers
    }
  }

  private buildWallSegment(
    dimension: Dimension,
    x: number,
    y: number,
    z: number,
    length: number,
    height: number,
    axis: "x" | "z"
  ): void {
    const blockType = BlockPermutation.resolve("minecraft:stone_bricks");

    for (let h = 0; h < height; h++) {
      for (let l = 0; l < length; l++) {
        const pos = axis === "x"
          ? { x: x + l, y: y + h, z: z }
          : { x: x, y: y + h, z: z + l };

        const block = dimension.getBlock(pos);
        block?.setPermutation(blockType);
      }
    }
  }

  private buildPerimeterWall(
    dimension: Dimension,
    center: Vector3,
    radius: number,
    height: number
  ): void {
    const blockType = BlockPermutation.resolve("minecraft:cobblestone");

    // Build four walls forming a square perimeter
    // North wall
    this.buildWallSegment(dimension, center.x - radius, center.y, center.z - radius, radius * 2, height, "x");
    // South wall
    this.buildWallSegment(dimension, center.x - radius, center.y, center.z + radius, radius * 2, height, "x");
    // West wall
    this.buildWallSegment(dimension, center.x - radius, center.y, center.z - radius, radius * 2, height, "z");
    // East wall
    this.buildWallSegment(dimension, center.x + radius, center.y, center.z - radius, radius * 2, height, "z");
  }

  private getLocationKey(location: Vector3): string {
    // Round to nearest 50 blocks to cluster nearby villages
    const x = Math.round(location.x / 50) * 50;
    const z = Math.round(location.z / 50) * 50;
    return `${x},${z}`;
  }

  private markVillageEnhanced(location: Vector3): void {
    const key = this.getLocationKey(location);
    this.enhancedVillages.add(key);
    // TODO: Persist to world dynamic properties for cross-session tracking
  }
}
```

### 3. `scripts/core/initialization/VillageDefenseInitializer.ts` (NEW)
```typescript
import { world, EntitySpawnAfterEvent } from "@minecraft/server";
import { IInitializer } from "./IInitializer";
import type { IVillageDefenseService } from "../features/village/IVillageDefenseService";

/**
 * Initializes village defense enhancement system
 * Detects village generation via villager spawns
 * Delegates defense placement to VillageDefenseService
 */
export class VillageDefenseInitializer implements IInitializer {
  constructor(private readonly defenseService: IVillageDefenseService) {}

  public initialize(): void {
    // Subscribe to entity spawn events to detect villages
    world.afterEvents.entitySpawn.subscribe(this.onEntitySpawn.bind(this));
  }

  private onEntitySpawn(event: EntitySpawnAfterEvent): void {
    // Detect villages via villager spawns
    if (event.entity.typeId === "minecraft:villager") {
      const villageLocation = event.entity.location;

      // Enhance village defenses based on distance from spawn
      this.defenseService.enhanceVillage(villageLocation);
    }
  }
}
```

### 4. `scripts/main.ts` (MODIFY)
**Add imports:**
```typescript
import { VillageDefenseInitializer } from "./core/initialization/VillageDefenseInitializer";
import { VillageDefenseService } from "./core/features/village/VillageDefenseService";
```

**Update initializePack():**
```typescript
function initializePack(): void {
  const messageProvider = new MessageProvider();
  const playerListFormService = new PlayerListFormService(messageProvider);
  const villageDefenseService = new VillageDefenseService();

  const initializers: IInitializer[] = [
    new WelcomeInitializer(messageProvider),
    new PlayerListInitializer(playerListFormService),
    new VillageDefenseInitializer(villageDefenseService),  // ADD THIS
  ];

  initializers.forEach((initializer) => initializer.initialize());
}
```

## Advanced Enhancements (Optional)

### Option A: Use Structure Manager for Complex Walls
Create `.mcstructure` files for pre-built wall segments and watchtowers:

```typescript
// Place watchtower structure at corners
world.structureManager.place(
  "minecraft_raids:watchtower",
  dimension,
  { x: center.x + 50, y: center.y, z: center.z + 50 }
);
```

### Option B: Custom Pillager AI (Friendly Guards)
Modify pillager behavior via components (requires custom entity definition):

```json
{
  "minecraft:behavior.defend_village_target": {
    "priority": 1,
    "entity_types": [
      { "filters": { "test": "is_family", "value": "monster" } }
    ]
  }
}
```

### Option C: Persistent Village Tracking
Use world dynamic properties to track enhanced villages across sessions:

```typescript
world.setDynamicProperty(`village_enhanced_${key}`, true);

// On world load, restore tracking
const isEnhanced = world.getDynamicProperty(`village_enhanced_${key}`);
```

## Challenges & Solutions

### Challenge 1: Detecting Village Center
**Problem:** Villagers can spawn anywhere in village
**Solution:** Use first villager spawn as approximate center, or cluster nearby spawns

### Challenge 2: Performance with Large Walls
**Problem:** Placing many blocks can cause lag
**Solution:** Use `system.runInterval()` to spread block placement across ticks

```typescript
let currentBlock = 0;
const blocks = getAllWallBlocks();

const intervalId = system.runInterval(() => {
  for (let i = 0; i < 50; i++) { // Place 50 blocks per tick
    if (currentBlock >= blocks.length) {
      system.clearRun(intervalId);
      return;
    }

    const pos = blocks[currentBlock];
    dimension.getBlock(pos)?.setPermutation(wallBlock);
    currentBlock++;
  }
}, 1);
```

### Challenge 3: Avoiding Duplicate Enhancements
**Problem:** Multiple villagers spawn per village
**Solution:** Track enhanced villages by rounded location key

### Challenge 4: Terrain Adaptation
**Problem:** Walls may float or be buried on uneven terrain
**Solution:** Find top-most block before placing walls

```typescript
function findGroundLevel(dimension: Dimension, x: number, z: number): number {
  for (let y = 100; y > -64; y--) {
    const block = dimension.getBlock({ x, y, z });
    if (block && !block.isAir) {
      return y + 1; // Return one block above ground
    }
  }
  return 64; // Default if not found
}
```

## Testing Plan

### Phase 1: Detection Testing
1. Create new world
2. `/locate structure village_plains`
3. Verify villager spawn triggers enhancement
4. Check distance calculation is accurate

### Phase 2: Defense Tier Testing
1. **Tier 0**: Create village near spawn (< 500 blocks) - should remain unmodified
2. **Tier 1**: Teleport 750 blocks from spawn - should add iron golems only
3. **Tier 2**: Teleport 1500 blocks from spawn - should add golems + low walls
4. **Tier 3**: Teleport 2500 blocks from spawn - should add full defenses

### Phase 3: Performance Testing
1. Trigger multiple village enhancements
2. Monitor FPS and tick time
3. Ensure block placement doesn't cause lag spikes

### Phase 4: Persistence Testing
1. Enhance a village
2. Exit and reload world
3. Verify village stays enhanced (doesn't re-trigger)

## File Structure

```
scripts/
├── core/
│   ├── features/
│   │   ├── village/
│   │   │   ├── IVillageDefenseService.ts      (NEW)
│   │   │   └── VillageDefenseService.ts       (NEW)
│   │   ├── IPlayerListFormService.ts
│   │   └── PlayerListFormService.ts
│   ├── initialization/
│   │   ├── VillageDefenseInitializer.ts       (NEW)
│   │   ├── PlayerListInitializer.ts
│   │   └── WelcomeInitializer.ts
│   └── messaging/
│       └── MessageProvider.ts
└── main.ts                                     (MODIFY)
```

## Why This Approach Works

✅ **Uses Available APIs**: All features use documented scripting APIs
✅ **Runtime Enhancement**: Works with vanilla villages without world-gen hooks
✅ **Progressive Defense**: Clear tiers based on distance from spawn
✅ **Performance Conscious**: Can spread block placement across ticks
✅ **Maintainable**: Follows existing SOLID architecture
✅ **Testable**: Services can be unit tested independently
✅ **Scalable**: Easy to add new defense tiers or patterns

## Alternative: Command-Based Enhancement

If scripting performance is an issue, use commands for instant wall placement:

```typescript
dimension.runCommandAsync(
  `fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} stone_bricks`
);
```

This is faster but less flexible than block-by-block placement.
