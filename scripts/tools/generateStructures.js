#!/usr/bin/env node

/**
 * Generates valid .mcstructure files for GameTest framework
 * Creates minimal NBT-formatted structures using prismarine-nbt
 */

const fs = require('fs');
const path = require('path');
const nbt = require('prismarine-nbt');

// Minecraft version for version field (1.21.0)
const MINECRAFT_VERSION = 18090528;

// Output directory
const STRUCTURES_DIR = path.join(
  __dirname,
  '../../behavior_packs/MinecraftRaids/structures/MinecraftRaids'
);

/**
 * Create block palette entries
 */
function createBlockPalette() {
  return {
    type: 'list',
    value: {
      type: 'compound',
      value: [
        // Air block (index 0)
        {
          name: { type: 'string', value: 'minecraft:air' },
          states: { type: 'compound', value: {} },
          version: { type: 'int', value: MINECRAFT_VERSION }
        },
        // Stone block (index 1)
        {
          name: { type: 'string', value: 'minecraft:stone' },
          states: {
            type: 'compound',
            value: {
              stone_type: { type: 'string', value: 'stone' }
            }
          },
          version: { type: 'int', value: MINECRAFT_VERSION }
        }
      ]
    }
  };
}

/**
 * Calculate block index in ZYX order
 * Order: iterate Z first, then Y, then X
 */
function getBlockIndex(x, y, z, width, height) {
  return z * (width * height) + y * width + x;
}

/**
 * Create block indices array
 * Layer 1: actual blocks
 * Layer 2: waterlogged blocks (all -1 for no waterlogging)
 */
function createBlockIndices(blockMap, width, height, depth) {
  const totalBlocks = width * height * depth;

  // Layer 1: actual blocks (ZYX order)
  const layer1 = new Array(totalBlocks).fill(0); // Default to air (0)

  // Layer 2: waterlogged (all -1 = no waterlogging)
  const layer2 = new Array(totalBlocks).fill(-1);

  // Fill in blocks from blockMap
  for (const [key, paletteIndex] of Object.entries(blockMap)) {
    const [x, y, z] = key.split(',').map(Number);
    const idx = getBlockIndex(x, y, z, width, height);
    layer1[idx] = paletteIndex;
  }

  return {
    type: 'list',
    value: {
      type: 'list',
      value: [
        { type: 'int', value: layer1 },
        { type: 'int', value: layer2 }
      ]
    }
  };
}

/**
 * Create a complete .mcstructure NBT structure
 */
function createStructure(width, height, depth, blockMap) {
  return {
    name: '', // Root compound has empty name
    type: 'compound',
    value: {
      format_version: { type: 'int', value: 1 },
      size: {
        type: 'list',
        value: { type: 'int', value: [width, height, depth] }
      },
      structure: {
        type: 'compound',
        value: {
          block_indices: createBlockIndices(blockMap, width, height, depth),
          palette: {
            type: 'compound',
            value: {
              default: {
                type: 'compound',
                value: {
                  block_palette: createBlockPalette(),
                  block_position_data: { type: 'compound', value: {} }
                }
              }
            }
          },
          entities: { type: 'list', value: { type: 'end', value: [] } }
        }
      },
      structure_world_origin: {
        type: 'list',
        value: { type: 'int', value: [0, 0, 0] }
      }
    }
  };
}

/**
 * Write structure to file
 */
function writeStructure(filename, structure) {
  const data = nbt.writeUncompressed(structure, 'little');
  const filepath = path.join(STRUCTURES_DIR, filename);
  fs.writeFileSync(filepath, data);
  return filepath;
}

/**
 * Create simple.mcstructure (4×3×4, all air)
 * Used by: Welcome, MessageProvider, PlayerList (2x), RaidParty (5x)
 */
function createSimpleStructure() {
  console.log('Creating simple.mcstructure (4×3×4, all air)...');
  // All air (no blocks to place)
  const blockMap = {};
  const structure = createStructure(4, 3, 4, blockMap);
  const filepath = writeStructure('simple.mcstructure', structure);
  const size = fs.statSync(filepath).size;
  console.log(`✓ simple.mcstructure (${size} bytes)`);
}

/**
 * Create wolf structure (3×3×3 with stone floor at Y=1)
 * All 6 wolf tests spawn at Y=2, need platform at Y=1
 */
function createWolfStructure(name) {
  console.log(`Creating ${name}.mcstructure (3×3×3 with stone floor)...`);

  // Create 3×3 stone platform at Y=1
  const blockMap = {};
  for (let x = 0; x < 3; x++) {
    for (let z = 0; z < 3; z++) {
      // Y=1: stone platform (paletteIndex 1)
      blockMap[`${x},1,${z}`] = 1;
    }
  }

  const structure = createStructure(3, 3, 3, blockMap);
  const filepath = writeStructure(`${name}.mcstructure`, structure);
  const size = fs.statSync(filepath).size;
  console.log(`✓ ${name}.mcstructure (${size} bytes)`);
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('Generating .mcstructure files...\n');

    // Ensure output directory exists
    if (!fs.existsSync(STRUCTURES_DIR)) {
      fs.mkdirSync(STRUCTURES_DIR, { recursive: true });
    }

    // Create simple structure
    createSimpleStructure();

    // Create wolf structures
    const wolfStructures = [
      'wolfStartsAtLevel1',
      'wolfCanReachLevel2',
      'wolfCanReachLevel3',
      'babyWolfStartsAtLevel1',
      'wolfLevelProgression',
      'wolfResetToLevel1'
    ];

    for (const name of wolfStructures) {
      createWolfStructure(name);
    }

    console.log('\n✓ Generated 7 structure files successfully!');
    console.log(`\nStructures saved to: ${STRUCTURES_DIR}`);

    // Verify file sizes
    console.log('\nFile verification:');
    const files = fs.readdirSync(STRUCTURES_DIR).filter(f => f.endsWith('.mcstructure'));
    for (const file of files) {
      const filepath = path.join(STRUCTURES_DIR, file);
      const size = fs.statSync(filepath).size;
      console.log(`  ${file}: ${size} bytes`);
    }

  } catch (error) {
    console.error('Error generating structures:', error.message);
    process.exit(1);
  }
}

main();
