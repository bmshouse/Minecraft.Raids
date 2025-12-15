# Testing Guide

This project follows Microsoft's recommended testing approach for Minecraft Bedrock scripts, combining unit tests for pure logic with in-game GameTest validation for Minecraft-specific features.

## Overview

Testing Strategy for Minecraft Raids:
1. **Unit Tests (Vitest)** - Pure TypeScript logic
2. **GameTest Framework** - In-game integration tests
3. **Manual Testing** - User experience and visual validation

## Unit Tests (Vitest)

### What Gets Unit Tested

- **MessageProvider**: Message retrieval and fallback logic
- Pure business logic without Minecraft API dependencies
- Fast, isolated, run offline

### Running Unit Tests

```bash
npm test              # Run all unit tests once
npm test:watch       # Run tests in watch mode
npm test:ui          # Run tests with interactive UI dashboard
```

### Example: MessageProvider Tests

The `scripts/core/messaging/MessageProvider.test.ts` file demonstrates TDD for pure logic:

```typescript
// Test message retrieval
const message = provider.getMessage("mc.raids.welcome");
expect(message).toBe("Welcome to Minecraft Raids!");

// Test fallback behavior
const fallback = provider.getMessage("missing.key", "Fallback");
expect(fallback).toBe("Fallback");
```

**Benefits:**
- Fast execution (milliseconds)
- No Minecraft required
- Can run in CI/CD
- Tight feedback loop during development

## Understanding GameTest Structure Blocks

### What Are Structure Blocks?

Structure blocks are special Minecraft blocks used to save and load building structures. In the GameTest framework, structure files (`.mcstructure`) define the test environment where your tests run.

**Key Concepts:**
- Each GameTest requires a structure file in your behavior pack
- Structure files are saved in `behavior_packs/MinecraftRaids/structures/MinecraftRaids/`
- Tests reference structures via `.structureName("MinecraftRaids:simple")`
- Structure blocks can be placed in-game for proximity-based testing with `/gametest runthese`

### Project Structure Files

This project includes pre-built structures for all tests. You don't need to manually create them:

| Structure File | Used By | Purpose |
|----------------|---------|---------|
| `simple.mcstructure` | 9 tests (default, raidparty suites) | Minimal flat platform for basic tests |
| `wolfStartsAtLevel1.mcstructure` | wolfStartsAtLevel1 | Wolf spawn and level validation |
| `wolfCanReachLevel2.mcstructure` | wolfCanReachLevel2 | Level progression test area |
| `wolfCanReachLevel3.mcstructure` | wolfCanReachLevel3 | Max level test area |
| `babyWolfStartsAtLevel1.mcstructure` | babyWolfStartsAtLevel1 | Wolf breeding test area |
| `wolfLevelProgression.mcstructure` | wolfLevelProgression | Multi-level progression area |
| `wolfResetToLevel1.mcstructure` | wolfResetToLevel1 | Level reset test area |

### Using `/gametest runthese` (Proximity-Based)

If you want to use `/gametest runthese`, you need to place structure blocks in your world:

1. **Enable Education Edition** in world settings for structure block access
2. **Use command**: `/give @s structure_block`
3. **Place the structure block** and configure it:
   - Set mode to "Load"
   - Reference a structure: `MinecraftRaids:simple` or similar
4. **Relative to that structure**, the tests will run
5. **Use in-game**: `/gametest runthese` runs all tests within ~100 blocks

### Creating Custom Structures

If you need custom test structures:

1. **Quick generation**: `/gametest create myTest 5 5 5` creates a 5×5×5 test area
2. **Manual creation**:
   - Build your test area in Creative Mode
   - Place structure block and frame the area
   - Export as `.mcstructure`
   - Reference in test: `.structureName("MinecraftRaids:myTest")`

## GameTest Framework

### What Gets GameTest Tested

- **WelcomeGameTest**: Welcome system initialization
- **MessageProviderGameTest**: Provider functionality in-game
- **PlayerListGameTest**: Player list UI validation
- **RaidPartyGameTest**: Raid party system and wolf management
- **WolfLevelingGameTest**: Wolf leveling progression and stat changes
- Entity interactions
- Block placement and behavior
- Game mechanics

### Why GameTest?

Microsoft's official samples don't use traditional mocking for `@minecraft/server` because:

1. **Tight Runtime Coupling** - The API is deeply integrated with Minecraft's engine
2. **Mocking Defeats Purpose** - Mocks disconnect from reality; real tests validate actual behavior
3. **Real Validation** - GameTest runs code IN Minecraft, proving it works
4. **TypeScript Safety** - Compiler provides static type checking
5. **Industry Standard** - Aligns with Microsoft's recommended approach

### Common GameTest Patterns

**Important:** See [CLAUDE.md - GameTest Entity Manipulation Best Practices](./CLAUDE.md#gametest-entity-manipulation-best-practices) for critical guidance on:

- **Behavior pack events vs API state** - Key distinction that prevents test failures
- **Entity initialization** - Why `test.spawn()` needs `entity_spawned` event
- **Taming entities** - Use `tameable.tame(player)` not `triggerEvent("minecraft:on_tame")`
- **SimulatedPlayer** - When and how to spawn test players
- **Common pitfalls** - Table of troubleshooting tips

This guidance is **essential** for writing correct entity tests.

### Running GameTests

#### Prerequisites

1. **Enable GameTest Framework Experiment** in Minecraft:
   - Launch Minecraft Bedrock
   - Settings → Experiments → GameTest Framework → Enable
   - This enables the `/gametest` command

2. **Deploy the Behavior Pack**:
   ```bash
   npm run local-deploy
   ```

3. **Load World with Pack**:
   - Create a new world or open existing
   - Add "Minecraft Raids" behavior pack

#### Running Tests

**Batch Execution (Recommended):**

Use tag-based commands to run multiple tests at once:

```bash
# Run ALL 15 tests at once
/gametest runset batch

# Run tests by suite
/gametest runset suite:default          # 4 tests: core system
/gametest runset suite:raidparty        # 5 tests: raid party & wolves
/gametest runset suite:wolf_leveling    # 6 tests: wolf progression
```

**Individual Tests:**

```bash
# Core tests
/gametest run MinecraftRaids:welcomeMessage
/gametest run MinecraftRaids:messageProvider
/gametest run MinecraftRaids:playerBookInitializer
/gametest run MinecraftRaids:bookNavigationMessages

# Raid party tests
/gametest run MinecraftRaids:wolfTaming
/gametest run MinecraftRaids:wolfQuery
/gametest run MinecraftRaids:wolfHealth
/gametest run MinecraftRaids:playerBookService
/gametest run MinecraftRaids:raidPartyMessages

# Wolf leveling tests
/gametest run MinecraftRaids:wolfStartsAtLevel1
/gametest run MinecraftRaids:wolfCanReachLevel2
/gametest run MinecraftRaids:wolfCanReachLevel3
/gametest run MinecraftRaids:babyWolfStartsAtLevel1
/gametest run MinecraftRaids:wolfLevelProgression
/gametest run MinecraftRaids:wolfResetToLevel1
```

**Proximity-Based Testing:**

```bash
# Run all tests whose structures are placed nearby (requires structure blocks)
/gametest runthese

# Run nearest test
/gametest runthis

# View test position
/gametest pos

# List available tests
/gametest list

# Clear test structures in radius
/gametest clearall 100
```

**Note on `/gametest runthese`:** This command runs tests based on structure block placement in your world. For comprehensive testing without manual block placement, use the tag-based `/gametest runset` approach instead (e.g., `/gametest runset batch`).

#### Expected Results

When tests pass, you'll see:
- Successful message in chat
- Particles or effects at test location (customizable)
- Output in Content Log (Settings → Creator)

**Viewing Test Output**:
- Open Content Log: Settings → Creator → Content Log GUI
- Tests use `console.warn()` for detailed logging
- View this log to see test assertions and results

### Example: MessageProviderGameTest

```typescript
export function messageProviderTest(test: gametest.Test) {
  const provider = new MessageProvider();

  // Test message retrieval
  const welcome = provider.getMessage("mc.raids.welcome");
  test.assert(
    welcome === "Welcome to Minecraft Raids!",
    "Welcome message should match"
  );

  // Test fallback
  const fallback = provider.getMessage("missing.key", "Fallback");
  test.assert(fallback === "Fallback", "Fallback should work");

  test.succeed();
}
```

### Example: WolfLevelingGameTest

The wolf leveling system includes comprehensive GameTests to validate progression mechanics:

**Individual Tests:**

```bash
# Test wolf starts at level 1 (20 HP, 4 damage, 1.0x scale)
/gametest run MinecraftRaids:wolfStartsAtLevel1

# Test wolf can reach level 2 (30 HP, 6 damage, 1.15x scale at 5 kills)
/gametest run MinecraftRaids:wolfCanReachLevel2

# Test wolf can reach level 3 (40 HP, 8 damage, 1.3x scale at 15 kills)
/gametest run MinecraftRaids:wolfCanReachLevel3

# Test baby wolves inherit level 1 stats
/gametest run MinecraftRaids:babyWolfStartsAtLevel1

# Test complete level progression: 1 → 2 → 3
/gametest run MinecraftRaids:wolfLevelProgression

# Test reset functionality
/gametest run MinecraftRaids:wolfResetToLevel1
```

**Batch Tests:**

```bash
# Run all wolf leveling tests (6 tests)
/gametest runset suite:wolf_leveling

# Run entire test suite (15 tests)
/gametest runset batch
```

**Wolf Leveling Features Tested:**
- ✅ Tamed wolves start at Level 1 with correct stats
- ✅ Wolf stats increase correctly on level-up
- ✅ Size scaling changes visually at each level
- ✅ Baby wolves (bred) inherit Level 1 stats
- ✅ Level progression: 1 → 2 → 3
- ✅ Reset functionality returns wolf to Level 1
- ✅ Kill count persists across world reloads (via dynamic properties)
- ✅ Only hostile mobs count toward progression
- ✅ Owner receives chat notification on level-up

## Manual Testing

### Primary Testing Method

For user experience and visual validation:

```bash
npm run local-deploy
```

This command:
1. Watches for TypeScript changes
2. Recompiles automatically
3. Deploys to Minecraft's development pack folder
4. Allows rapid iteration

### Testing in Minecraft

1. **Launch Minecraft Bedrock**
2. **Create World with Behavior Pack**
   - New World → Behavior Packs → Add "Minecraft Raids"
3. **Load World**
4. **Verify Behavior**
   - Check welcome messages in chat
   - Look for any error messages
   - Test any player interactions

### Manual Wolf Leveling Testing

**Test Sequence:**

1. **Tame a Wolf**
   - Find a wolf in the wild
   - Right-click with bones to tame
   - Verify it sits and has a colored collar

2. **Observe Level 1 (Base Stats)**
   - Tamed wolf should have normal size (1.0x)
   - Wait for test confirmation chat message

3. **Test Level Progression**
   - Summon 5 hostile mobs: `/summon zombie`
   - Let the wolf kill them (it will attack autonomously)
   - Watch for chat message: "Your wolf leveled up to Level 2!"
   - Wolf should visibly grow larger (1.15x scale)

4. **Test Level 2 to 3**
   - Summon 10 more hostile mobs (skeletons, creepers, etc.)
   - Let wolf kill all of them
   - Watch for: "Your wolf leveled up to Level 3!"
   - Wolf should grow even larger (1.3x scale)

5. **Test Persistence**
   - Level up a wolf to level 3
   - Save and quit world
   - Reload world
   - Wolf should retain level and larger size (dynamic properties persist)

6. **Test Passive Mobs Don't Count**
   - Summon a chicken: `/summon chicken`
   - Have wolf kill it
   - Verify kill count does NOT increase

7. **Test Owner Notification**
   - Stand near the wolf when it levels up
   - Verify you receive chat notification with level number and total kills

8. **Test Baby Wolves**
   - Breed two tamed wolves with meat
   - Wait for baby to grow up
   - Have it kill hostile mobs
   - Verify it can level up normally

### Using Content Log

Monitor pack errors:
- Settings → Creator → Enable Content Log GUI
- Content Log window shows all errors and messages

## Testing Philosophy

> "Test code as close to production as possible. For Minecraft scripts, that means testing IN Minecraft."

### Division of Responsibilities

| Test Type | What | Where | When |
|-----------|------|-------|------|
| **Unit** | Pure logic, message handling | Vitest, offline | Every save |
| **GameTest** | Minecraft interactions, behavior | In-game | During development |
| **Manual** | User experience, visual feedback | Minecraft | Before release |

### What NOT to Unit Test

❌ Code that imports `@minecraft/server`
❌ World interactions
❌ Entity behavior
❌ Chat message output to players

**Why?** These require Minecraft's runtime. GameTest or manual testing is more appropriate.

### What TO Unit Test

✅ Message formatting logic
✅ Configuration parsing
✅ Utility functions
✅ Pure TypeScript logic without Minecraft APIs

## Continuous Integration

Current setup (in `.github/workflows/`):

1. **Lint**: Check code style
   ```bash
   npm run lint
   ```

2. **Build**: Compile and bundle
   ```bash
   npm run build
   ```

3. **Unit Tests**: Run Vitest
   ```bash
   npm test
   ```

4. **Package**: Create .mcaddon
   ```bash
   npm run mcaddon
   ```

CI does NOT run GameTest (requires interactive Minecraft).

## Adding New Tests

### For Pure Logic (Unit Test)

1. Create `src/module/feature.test.ts`:
   ```typescript
   import { describe, it, expect } from "vitest";
   import { feature } from "./feature";

   describe("feature", () => {
     it("should work", () => {
       expect(feature()).toBe(expected);
     });
   });
   ```

2. Run: `npm test`

### For Minecraft Features (GameTest)

1. Create `scripts/gametests/FeatureGameTest.ts`:
   ```typescript
   import * as gametest from "@minecraft/server-gametest";

   export function featureTest(test: gametest.Test) {
     // Test your feature
     test.succeed();
   }

   gametest.register("MinecraftRaids", "feature", featureTest);
   ```

2. Import in `scripts/main.ts`:
   ```typescript
   import "./gametests/FeatureGameTest";
   ```

3. Run in-game: `/gametest run MinecraftRaids:feature`

## Troubleshooting

### Unit Test Errors

```
Failed to resolve entry for package "@minecraft/server"
```

**Solution:** This test imports Minecraft APIs. Convert to GameTest or refactor to not use Minecraft APIs.

### GameTest Not Running

1. **GameTest Framework disabled**
   - Enable in Settings → Experiments
   - Restart Minecraft

2. **Pack not deployed**
   - Run `npm run local-deploy`
   - Reload world

3. **Test not registered**
   - Ensure file is imported in `main.ts`
   - Run `/gametest list` to see available tests

### Gametest says "Failed"

1. Check chat for error message
2. Run `/gametest showlog` for details
3. Add more specific assertions in test

### Entity State Assertions Failing

**Symptom:** Component exists but assertion on `isTamed`, `isDying`, etc. fails

**Cause:** You're confusing component groups (behavior pack) with API state (TypeScript)

**Solution:** Use script API methods instead of events to set entity state

```typescript
// ❌ WRONG - event doesn't set API state
wolf.triggerEvent("minecraft:on_tame");
test.assert(tameable.isTamed === true, "FAILS");  // Still false!

// ✅ CORRECT - API method sets both component AND API state
const player = test.spawnSimulatedPlayer({ x: 0, y: 0, z: 0 }, "Player");
tameable.tame(player);
test.assert(tameable.isTamed === true, "PASSES");
```

**See also:** [CLAUDE.md - GameTest Entity Manipulation Best Practices](./CLAUDE.md#gametest-entity-manipulation-best-practices)

### Entity Components Missing After Spawn

**Symptom:** NullReferenceError when calling `getComponent()` after `test.spawn()`

**Cause:** `test.spawn()` doesn't automatically trigger `entity_spawned` event

**Solution:** Manually trigger the initialization event

```typescript
const wolf = test.spawn("minecraft:wolf", { x: 1, y: 0, z: 0 });
wolf.triggerEvent("minecraft:entity_spawned");  // Add this line!

const tameable = wolf.getComponent(EntityComponentTypes.Tameable);  // Now safe
```

## Resources

- [Microsoft Minecraft Scripting Samples](https://github.com/microsoft/minecraft-scripting-samples)
- [Bedrock Wiki - GameTest](https://wiki.bedrock.dev/scripting/gametest/gametest-intro.html)
- [Vitest Documentation](https://vitest.dev/)
- [Minecraft Creator Documentation](https://learn.microsoft.com/en-us/minecraft/creator/)
