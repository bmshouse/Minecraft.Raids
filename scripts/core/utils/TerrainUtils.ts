import { system, type Dimension, type Block, BlockPermutation } from "@minecraft/server";

/**
 * Surface types detected by terrain analysis
 */
export enum SurfaceType {
  Solid = "solid",
  Water = "water",
  Lava = "lava",
  Air = "air", // Void - no ground found
}

/**
 * Result of ground level search
 */
export interface GroundSearchResult {
  groundY: number; // Y-coordinate of ground level
  surfaceType: SurfaceType; // Type of surface found
  needsPlatform: boolean; // Whether platform building is needed
  platformSize?: number; // Required platform radius if needed
}

/**
 * Cached ground data with timestamp
 */
interface CachedGroundData {
  result: GroundSearchResult;
  timestamp: number; // system.currentTick
  chunkLoaded: boolean;
}

/**
 * Terrain utility for finding ground level and building platforms
 * Provides centralized terrain awareness for all spawning systems
 */
export class TerrainUtils {
  private static readonly CACHE_EXPIRY_TICKS = 6000; // 5 minutes at 20 TPS
  private static readonly MAX_CACHE_SIZE = 1000; // Max cached positions
  private static readonly WATER_DEPTH_CHECK = 10; // Blocks to check below water

  /**
   * Blocks considered valid ground for spawning/building
   * Natural terrain blocks that provide stable foundation
   */
  private static readonly VALID_GROUND_BLOCKS = new Set<string>([
    // Natural stone variants
    "minecraft:stone",
    "minecraft:granite",
    "minecraft:diorite",
    "minecraft:andesite",
    "minecraft:deepslate",
    "minecraft:tuff",
    "minecraft:calcite",
    "minecraft:basalt",
    "minecraft:blackstone",

    // Dirt and grass
    "minecraft:dirt",
    "minecraft:grass_block",
    "minecraft:coarse_dirt",
    "minecraft:podzol",
    "minecraft:mycelium",
    "minecraft:rooted_dirt",
    "minecraft:mud",
    "minecraft:muddy_mangrove_roots",

    // Sand and gravel
    "minecraft:sand",
    "minecraft:red_sand",
    "minecraft:sandstone",
    "minecraft:red_sandstone",
    "minecraft:gravel",

    // Snow (ice removed - needs platforms)
    "minecraft:snow_block",

    // Clay and terracotta
    "minecraft:clay",
    "minecraft:terracotta",
    "minecraft:white_terracotta",
    "minecraft:orange_terracotta",
    "minecraft:magenta_terracotta",
    "minecraft:light_blue_terracotta",
    "minecraft:yellow_terracotta",
    "minecraft:lime_terracotta",
    "minecraft:pink_terracotta",
    "minecraft:gray_terracotta",
    "minecraft:light_gray_terracotta",
    "minecraft:cyan_terracotta",
    "minecraft:purple_terracotta",
    "minecraft:blue_terracotta",
    "minecraft:brown_terracotta",
    "minecraft:green_terracotta",
    "minecraft:red_terracotta",
    "minecraft:black_terracotta",

    // Nether terrain
    "minecraft:netherrack",
    "minecraft:soul_sand",
    "minecraft:soul_soil",
    "minecraft:crimson_nylium",
    "minecraft:warped_nylium",

    // End terrain
    "minecraft:end_stone",

    // Player-built blocks
    "minecraft:cobblestone",
    "minecraft:mossy_cobblestone",
    "minecraft:stone_bricks",
    "minecraft:mossy_stone_bricks",
    "minecraft:iron_block",
    "minecraft:oak_planks",
  ]);

  // Cache: "x_z" → CachedGroundData
  private static groundCache = new Map<string, CachedGroundData>();

  /**
   * Find ground level at given XZ coordinates
   * Uses intelligent search to handle mountains, caves, and underground spawning
   *
   * @param dimension - The dimension to search in
   * @param x - X coordinate
   * @param z - Z coordinate
   * @param startY - Starting Y for search (default: 100)
   * @returns Ground search result or undefined if chunk not loaded
   */
  public static findGroundLevel(
    dimension: Dimension,
    x: number,
    z: number,
    startY: number = 100
  ): GroundSearchResult | undefined {
    // Check cache first
    const cached = this.getGroundFromCache(x, z);
    if (cached) {
      return cached.result;
    }

    // STEP 1: Check if we're starting inside solid terrain (mountain interior)
    const startBlock = dimension.getBlock({ x, y: startY, z });
    if (startBlock === undefined) {
      return undefined; // Chunk not loaded
    }

    const startingInsideTerrain = this.VALID_GROUND_BLOCKS.has(startBlock.typeId);

    // STEP 2: If inside terrain, search UPWARD first to find the surface
    if (startingInsideTerrain) {
      for (let y = startY + 1; y <= 320; y++) {
        const block = dimension.getBlock({ x, y, z });
        if (block === undefined) {
          return undefined; // Chunk not loaded
        }

        // Found air or liquid - the block below is the surface
        if (block.isAir || block.isLiquid) {
          const result = this.checkBlockAtY(dimension, x, y - 1, z);
          if (result) {
            this.cacheGround(x, z, result, true);
            return result;
          }
        }
      }
    }

    // STEP 3: Search downward from startY (for air starts or if upward search failed)
    for (let y = startY; y >= -64; y--) {
      const result = this.checkBlockAtY(dimension, x, y, z);
      if (result) {
        this.cacheGround(x, z, result, true);
        return result;
      }
      if (result === null) {
        // Chunk not loaded
        return undefined;
      }
    }

    // STEP 4: If still not found, search upward to Y=320 (tall mountains)
    for (let y = startY + 1; y <= 320; y++) {
      const result = this.checkBlockAtY(dimension, x, y, z);
      if (result) {
        this.cacheGround(x, z, result, true);
        return result;
      }
      if (result === null) {
        // Chunk not loaded
        return undefined;
      }
    }

    // No ground found (void) - return air platform at start Y
    const voidResult: GroundSearchResult = {
      groundY: startY,
      surfaceType: SurfaceType.Air,
      needsPlatform: true,
    };
    this.cacheGround(x, z, voidResult, true);
    return voidResult;
  }

  /**
   * Check block at specific Y level
   * Returns GroundSearchResult if ground found, false if air, null if chunk not loaded
   */
  private static checkBlockAtY(
    dimension: Dimension,
    x: number,
    y: number,
    z: number
  ): GroundSearchResult | false | null {
    const block = dimension.getBlock({ x, y, z });

    if (block === undefined) {
      return null; // Chunk not loaded
    }

    // Check if liquid (water or lava) - handle separately
    if (block.isLiquid) {
      const liquidY = y;
      const liquidType =
        block.typeId === "minecraft:lava" || block.typeId === "minecraft:flowing_lava"
          ? SurfaceType.Lava
          : SurfaceType.Water;

      // Check for solid ground under water (within 10 blocks)
      for (let checkY = y - 1; checkY >= y - this.WATER_DEPTH_CHECK && checkY >= -64; checkY--) {
        const belowBlock = dimension.getBlock({ x, y: checkY, z });
        if (belowBlock === undefined) {
          return null; // Chunk not loaded
        }
        // Use whitelist for underwater ground check
        if (this.VALID_GROUND_BLOCKS.has(belowBlock.typeId)) {
          // Found solid under water - use water surface as ground
          return {
            groundY: liquidY,
            surfaceType: liquidType,
            needsPlatform: true,
          };
        }
      }

      // No solid under water (deep ocean) - use water surface
      return {
        groundY: liquidY,
        surfaceType: liquidType,
        needsPlatform: true,
      };
    }

    // NEW: Whitelist-based solid ground check
    if (this.VALID_GROUND_BLOCKS.has(block.typeId)) {
      return {
        groundY: y,
        surfaceType: SurfaceType.Solid,
        needsPlatform: false,
      };
    }

    // NOT valid ground (leaves, logs, air, etc.) - continue searching
    return false;
  }

  /**
   * Build a circular platform at specified location
   * Uses system.runJob to spread construction across ticks
   *
   * @param dimension - Dimension to build in
   * @param centerX - Center X coordinate
   * @param centerZ - Center Z coordinate
   * @param groundY - Y level to build platform at
   * @param radius - Platform radius in blocks
   * @param material - Block type (default: auto-select based on surface)
   */
  public static async buildPlatform(
    dimension: Dimension,
    centerX: number,
    centerZ: number,
    groundY: number,
    radius: number,
    material?: string
  ): Promise<void> {
    // Cap radius to prevent lag
    const cappedRadius = Math.min(radius, 50);
    if (radius > 50) {
      console.warn(`[TerrainUtils] Platform radius capped at 50 (requested ${radius})`);
    }

    // Auto-select material if not provided
    const centerBlock = dimension.getBlock({ x: centerX, y: groundY, z: centerZ });
    const platformMaterial =
      material ||
      (centerBlock?.typeId === "minecraft:lava" || centerBlock?.typeId === "minecraft:flowing_lava"
        ? "minecraft:stone"
        : centerBlock?.isLiquid
          ? "minecraft:oak_planks"
          : "minecraft:stone");

    console.log(
      `[TerrainUtils] Building ${cappedRadius}-block platform at (${centerX}, ${groundY}, ${centerZ}) with ${platformMaterial}`
    );

    // STEP 1: Build horizontal platform using system.runJob
    let platformComplete = false;

    system.runJob(
      (function* () {
        try {
          for (let x = -cappedRadius; x <= cappedRadius; x++) {
            for (let z = -cappedRadius; z <= cappedRadius; z++) {
              // Circular platform check
              const distanceSquared = x * x + z * z;
              if (distanceSquared <= cappedRadius * cappedRadius) {
                const block = dimension.getBlock({
                  x: centerX + x,
                  y: groundY,
                  z: centerZ + z,
                });

                if (block && (block.isLiquid || block.typeId === "minecraft:air")) {
                  block.setPermutation(BlockPermutation.resolve(platformMaterial));
                }
              }
              yield; // Spread across ticks
            }
          }
          platformComplete = true;
        } catch (error) {
          console.error(`[TerrainUtils] Error building platform: ${error}`);
          platformComplete = true;
        }
      })()
    );

    // Poll for platform completion
    const maxWaitTicks = Math.min(cappedRadius * cappedRadius + 50, 300); // Cap at 300 ticks (15 sec)
    let waitedTicks = 0;

    while (!platformComplete && waitedTicks < maxWaitTicks) {
      await new Promise<void>((resolve) => {
        system.runTimeout(() => resolve(), 5);
      });
      waitedTicks += 5;
    }

    if (!platformComplete) {
      console.warn(
        `[TerrainUtils] buildPlatform timed out after ${waitedTicks} ticks at ${centerX}, ${groundY}, ${centerZ}`
      );
    }

    // STEP 2: Clear vertical space above platform (Y+1 through Y+4)
    await this.clearVerticalSpace(
      dimension,
      centerX,
      centerZ,
      groundY,
      cappedRadius,
      4, // 4 blocks vertical clearance
      true // clearAll = excavate mountains if needed
    );
  }

  /**
   * Clear vertical space above a position
   * Removes obstructions (leaves, logs, stone, dirt, etc.) to create spawn room
   *
   * @param dimension - Dimension to clear in
   * @param centerX - Center X coordinate
   * @param centerZ - Center Z coordinate
   * @param groundY - Ground level (Y where clearing starts)
   * @param radius - Horizontal radius to clear
   * @param height - Vertical height to clear (default: 4 blocks)
   * @param clearAll - If true, clears ALL blocks. If false, only clears replaceable blocks (default: true)
   */
  public static async clearVerticalSpace(
    dimension: Dimension,
    centerX: number,
    centerZ: number,
    groundY: number,
    radius: number,
    height: number = 4,
    clearAll: boolean = true
  ): Promise<void> {
    const cappedRadius = Math.min(radius, 50);
    let jobComplete = false;

    console.log(
      `[TerrainUtils] Clearing ${height} blocks above (${centerX}, ${groundY}, ${centerZ}), radius ${cappedRadius}`
    );

    system.runJob(
      (function* () {
        try {
          // Clear Y+1 through Y+height
          for (let y = groundY + 1; y <= groundY + height; y++) {
            for (let x = -cappedRadius; x <= cappedRadius; x++) {
              for (let z = -cappedRadius; z <= cappedRadius; z++) {
                // Circular area check
                const distanceSquared = x * x + z * z;
                if (distanceSquared <= cappedRadius * cappedRadius) {
                  const block = dimension.getBlock({
                    x: centerX + x,
                    y: y,
                    z: centerZ + z,
                  });

                  if (block && !block.isAir) {
                    if (clearAll) {
                      // Excavate everything (mountains)
                      block.setPermutation(BlockPermutation.resolve("minecraft:air"));
                    } else {
                      // Only clear replaceable blocks (leaves, plants)
                      if (TerrainUtils.isReplaceableBlock(block)) {
                        block.setPermutation(BlockPermutation.resolve("minecraft:air"));
                      }
                    }
                  }
                }
                yield; // Spread across ticks
              }
            }
          }
          jobComplete = true;
        } catch (error) {
          console.error(`[TerrainUtils] Error clearing vertical space: ${error}`);
          jobComplete = true;
        }
      })()
    );

    // Poll for completion with dynamic timeout based on area size
    const maxWaitTicks = Math.min(cappedRadius * cappedRadius * height, 200); // Cap at 200 ticks (10 sec)
    let waitedTicks = 0;

    while (!jobComplete && waitedTicks < maxWaitTicks) {
      await new Promise<void>((resolve) => {
        system.runTimeout(() => resolve(), 5);
      });
      waitedTicks += 5;
    }

    if (!jobComplete) {
      console.warn(
        `[TerrainUtils] clearVerticalSpace timed out after ${waitedTicks} ticks at ${centerX}, ${groundY}, ${centerZ}`
      );
    }
  }

  /**
   * Check if block is naturally replaceable (safe to clear)
   * Includes vegetation, snow layers, liquids, but NOT solid terrain
   *
   * @param block - Block to check
   * @returns true if block can be safely replaced
   */
  private static isReplaceableBlock(block: Block): boolean {
    const typeId = block.typeId;

    // Air and liquids always replaceable
    if (block.isAir || block.isLiquid) {
      return true;
    }

    // Vegetation patterns
    if (
      typeId.includes("leaves") ||
      typeId.includes("log") ||
      typeId.includes("wood") ||
      typeId.includes("grass") ||
      typeId.includes("fern") ||
      typeId.includes("flower") ||
      typeId.includes("sapling") ||
      typeId.includes("vine") ||
      typeId.includes("mushroom") ||
      typeId === "minecraft:snow" || // Snow layer (not snow_block)
      typeId === "minecraft:tall_grass" ||
      typeId === "minecraft:large_fern" ||
      typeId === "minecraft:dead_bush"
    ) {
      return true;
    }

    return false;
  }

  /**
   * Analyze terrain variance in an area
   * Used to detect steep terrain that needs platform leveling
   *
   * @param dimension - Dimension to analyze
   * @param centerX - Center X coordinate
   * @param centerZ - Center Z coordinate
   * @param radius - Area radius to analyze
   * @returns Variance in blocks (max Y - min Y)
   */
  public static analyzeTerrainVariance(
    dimension: Dimension,
    centerX: number,
    centerZ: number,
    radius: number
  ): number {
    // Sample 9 points in 3x3 grid
    const samplePoints = [
      { x: centerX, z: centerZ }, // Center
      { x: centerX - radius, z: centerZ - radius }, // NW
      { x: centerX, z: centerZ - radius }, // N
      { x: centerX + radius, z: centerZ - radius }, // NE
      { x: centerX - radius, z: centerZ }, // W
      { x: centerX + radius, z: centerZ }, // E
      { x: centerX - radius, z: centerZ + radius }, // SW
      { x: centerX, z: centerZ + radius }, // S
      { x: centerX + radius, z: centerZ + radius }, // SE
    ];

    const groundLevels: number[] = [];

    for (const point of samplePoints) {
      const result = this.findGroundLevel(dimension, point.x, point.z);
      if (result) {
        groundLevels.push(result.groundY);
      }
    }

    if (groundLevels.length === 0) {
      return 0; // No valid samples
    }

    const maxY = Math.max(...groundLevels);
    const minY = Math.min(...groundLevels);
    return maxY - minY;
  }

  /**
   * Get cached ground data if available and recent
   */
  private static getGroundFromCache(x: number, z: number): CachedGroundData | undefined {
    const key = `${Math.round(x)}_${Math.round(z)}`;
    const cached = this.groundCache.get(key);

    if (!cached) {
      return undefined;
    }

    // Check if cache expired
    const currentTick = system.currentTick;
    if (currentTick - cached.timestamp > this.CACHE_EXPIRY_TICKS) {
      this.groundCache.delete(key);
      return undefined;
    }

    return cached;
  }

  /**
   * Cache ground search result
   */
  private static cacheGround(
    x: number,
    z: number,
    result: GroundSearchResult,
    chunkLoaded: boolean
  ): void {
    const key = `${Math.round(x)}_${Math.round(z)}`;

    // LRU eviction if cache too large
    if (this.groundCache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = this.groundCache.keys().next().value;
      if (firstKey) {
        this.groundCache.delete(firstKey);
      }
    }

    this.groundCache.set(key, {
      result,
      timestamp: system.currentTick,
      chunkLoaded,
    });
  }
}
