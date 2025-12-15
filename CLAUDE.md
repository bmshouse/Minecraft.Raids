# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Minecraft Raids is a modern TypeScript-based behavior pack for Minecraft Bedrock Edition v1.21+ that demonstrates software architecture best practices including SOLID principles, dependency injection, and a hybrid testing strategy (unit tests + GameTest framework).

## Common Commands

```bash
# Development workflow
npm run build           # Build TypeScript and bundle (one-time)
npm run local-deploy    # Watch mode - auto-rebuild and deploy on file changes
npm run lint            # Check code style with ESLint
npm run lint --fix      # Auto-fix linting issues

# Testing
npm test                # Run unit tests (Vitest) once
npm test:watch          # Run tests in watch mode
npm test:ui             # Open interactive test UI dashboard

# Distribution
npm run mcaddon         # Create .mcaddon package file for sharing
npm run clean           # Clean build artifacts
```

### Running Single Tests

```bash
# Run specific test file
npm test -- MessageProvider.test.ts

# Run tests matching a pattern
npm test -- --grep "message"

# Run tests in debug mode
npm test -- --inspect-brk
```

### GameTest Commands (In-Game)

After deploying with `npm run local-deploy` and loading the pack in Minecraft:

**Batch Execution (Recommended):**

```bash
# Run all tests (15 tests)
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

**Debugging:**

```bash
/gametest pos          # Show test position
/gametest list         # List available tests
/gametest clearall 100 # Clear test structures
# View test output: Settings → Creator → Content Log GUI
```

**Note:** `/gametest runthese` is proximity-based and requires structure blocks to be placed in-world. Use `/gametest runset batch` for comprehensive testing.

## Architecture Overview

### High-Level Structure

```
scripts/
├── main.ts                      # Entry point - orchestrates initialization
├── core/
│   ├── initialization/          # IInitializer pattern - extensible startup
│   │   ├── IInitializer.ts      # Interface for all initializers
│   │   ├── WelcomeInitializer.ts
│   │   └── PlayerListInitializer.ts
│   ├── messaging/               # i18n message system
│   │   ├── IMessageProvider.ts  # Interface for message retrieval
│   │   ├── MessageProvider.ts   # Implementation
│   │   └── MessageProvider.test.ts  # Unit tests
│   └── features/                # Feature implementations
│       └── PlayerListFormService.ts
└── gametests/                   # In-game GameTest tests
    ├── WelcomeGameTest.ts
    ├── MessageProviderGameTest.ts
    └── PlayerListGameTest.ts
```

### Key Architectural Patterns

**1. Composition Root (main.ts:27-40)**
- All dependencies created and wired in one place
- Easy to see the entire initialization graph
- Changes to dependencies only need updates here

```typescript
const messageProvider = new MessageProvider();
const playerListFormService = new PlayerListFormService(messageProvider);
const initializers: IInitializer[] = [
  new WelcomeInitializer(messageProvider),
  new PlayerListInitializer(playerListFormService),
];
```

**2. IInitializer Pattern**
- Extensible startup system
- New features added without modifying existing code (Open/Closed Principle)
- Implement `IInitializer` interface and add to composition root

**3. Dependency Injection via Constructor**
- Classes depend on abstract interfaces, not concrete implementations
- Enables testing with mock implementations
- Example: `WelcomeInitializer` takes `IMessageProvider` interface

**4. Interface Segregation**
- `IMessageProvider` - message retrieval only
- `IInitializer` - initialization only
- `IPlayerListFormService` - form UI only
- Keeps interfaces focused and testable

### SOLID Principles Applied

| Principle | Implementation | Examples |
|-----------|-----------------|----------|
| **S**ingle Responsibility | Each class has one reason to change | `MessageProvider` manages messages only; `WelcomeInitializer` handles welcome logic |
| **O**pen/Closed | Open for extension, closed for modification | New initializers added without changing existing code |
| **L**iskov Substitution | Derived classes are substitutable | Any `IInitializer` can be used in the array |
| **I**nterface Segregation | Small focused interfaces | `IMessageProvider`, `IInitializer`, `IPlayerListFormService` |
| **D**ependency Inversion | Depend on abstractions | Classes depend on interfaces, not concrete implementations |

## Testing Strategy

This project follows **Microsoft's recommended testing approach** - not mocking the Minecraft API because it's too tightly coupled to the runtime. Instead:

### Unit Tests (Vitest)
**What:** Pure TypeScript logic without Minecraft API dependencies
**Where:** Files named `*.test.ts`
**When:** Every save (watch mode)
**Examples:**
- `MessageProvider.test.ts` - Message retrieval, fallback behavior
- Utility functions, configuration parsing
- Logic that doesn't interact with Minecraft

**Run with:** `npm test`, `npm test:watch`, `npm test:ui`

### GameTest Framework (In-Game)
**What:** Minecraft-specific features, entity interactions, world changes
**Where:** `scripts/gametests/*.ts`
**When:** During development before release
**Examples:**
- `WelcomeGameTest.ts` - Player spawn, welcome message sending
- `MessageProviderGameTest.ts` - Message system in actual Minecraft context
- `PlayerListGameTest.ts` - Form UI rendering

**Run with:** `/gametest run MinecraftRaids:testName`

### GameTest Entity Manipulation Best Practices

**Critical distinction:** Behavior pack events and script API state are separate systems.

#### Component Groups vs API State

- **Behavior pack events** (`triggerEvent()`) modify component groups (JSON-level state)
- **Script API methods** (like `tame()`) modify entity state that the TypeScript API reads
- These are NOT the same! A component can exist without the API property being set, and vice versa

**Example - Wolf Taming:**

❌ **DON'T DO THIS** (events don't set API state):
```typescript
const wolf = test.spawn("minecraft:wolf", { x: 1, y: 0, z: 0 });
wolf.triggerEvent("minecraft:entity_spawned");
wolf.triggerEvent("minecraft:on_tame");  // Adds components but API isTamed stays FALSE

const tameable = wolf.getComponent(EntityComponentTypes.Tameable);
test.assert(tameable.isTamed === true, "FAILS - event didn't set API state");
```

✅ **DO THIS** (use official API methods):
```typescript
const wolf = test.spawn("minecraft:wolf", { x: 1, y: 0, z: 0 });
wolf.triggerEvent("minecraft:entity_spawned");  // Initialize component groups

const player = test.spawnSimulatedPlayer({ x: 0, y: 0, z: 0 }, "TestPlayer");
const tameable = wolf.getComponent(EntityComponentTypes.Tameable);
tameable.tame(player);  // Sets both components AND API state

test.assert(tameable.isTamed === true, "PASSES - API state is set");
```

#### Key Rules for GameTest Entity Testing

1. **Always trigger `entity_spawned` after `test.spawn()`** - `test.spawn()` doesn't auto-trigger initialization events
   ```typescript
   const entity = test.spawn("minecraft:wolf", location);
   entity.triggerEvent("minecraft:entity_spawned");  // Required for component groups
   ```

2. **Use script API methods for state changes, NOT events** - When testing entity state:
   - ❌ `entity.triggerEvent("minecraft:on_tame")` - only changes components
   - ✅ `tameable.tame(player)` - sets API state
   - ❌ `entity.triggerEvent("minecraft:on_death")` - only changes components
   - ✅ `health.setCurrentValue(0)` - kills entity properly

3. **Use `SimulatedPlayer` when tests require a player** - Many entity interactions need a player:
   ```typescript
   const player = test.spawnSimulatedPlayer({ x: 0, y: 0, z: 0 }, "TestPlayer");
   const tameable = entity.getComponent(EntityComponentTypes.Tameable);
   tameable.tame(player);  // Needs a real player entity
   ```

4. **Events CAN be used for triggering side effects** - Events are fine for triggering behavior pack logic:
   ```typescript
   // OK - triggering level-up event for stats change
   wolf.triggerEvent("minecraftraids:level_up_to_2");
   ```
   But if you're testing the resulting state, use API methods to verify it.

5. **Prefer API methods from official examples** - When unsure how to do something:
   - Check `reference/bedrock-wiki/docs/entities/` for API usage patterns
   - All Microsoft examples use API methods, NOT events, for programmatic changes
   - Example: `reference/bedrock-wiki/docs/entities/spawning-tamed-entities.md` shows `tameable.tame(player)`

#### Why Events Don't Work for API Checks

Events are designed for **in-game player interactions** and **behavior pack responses**:
- Player right-clicks wolf with bone → `minecraft:on_tame` event fires → component groups change
- Behavior pack responds to state change

But in tests, when you manually trigger events:
- Event fires → component groups change (JSON-level)
- Minecraft engine does NOT update corresponding API state
- Your assertion checking API properties fails

The `tame()` method, by contrast, is the **internal engine function** that:
1. Sets the entity's owner field
2. Updates API-level properties
3. May trigger behavior pack events as a side effect

#### Common Pitfalls

| Problem | Cause | Solution |
|---------|-------|----------|
| `isTamed === false` after triggering `on_tame` event | Events don't set API state | Use `tameable.tame(player)` |
| NullReferenceError on component | `test.spawn()` doesn't initialize entities | Add `entity.triggerEvent("minecraft:entity_spawned")` |
| Test expects player owner but wolf has none | Taming event without actual player | Use `SimulatedPlayer` and call `tame(player)` |
| Component exists but API property doesn't match | Confusing component groups with API state | Use API methods to set state, events for side effects |

### Manual Testing
**What:** User experience and visual validation
**Where:** Live Minecraft client
**When:** Before release
**How:** `npm run local-deploy` then test in-game

## Message System (i18n)

Messages are defined in two places:

**1. TypeScript (MessageProvider.ts)**
```typescript
private readonly messages: Record<string, string> = {
  "mc.raids.welcome": "Welcome to Minecraft Raids!",
  // Add new messages here
};
```

**2. Resource Pack (resource_packs/MinecraftRaids/texts/en_US.lang)**
```lang
mc.raids.welcome=Welcome to Minecraft Raids!
```

**Retrieve in code:**
```typescript
const message = messageProvider.getMessage("mc.raids.welcome");
const withFallback = messageProvider.getMessage("missing.key", "Default");
```

## Guard Wolf Feature

Enhanced wolf behavior when tamed using behavior pack overrides and a leveling progression system.

### Base Guard Wolf Behavior

**Behavior Changes:**
- **Closer following** - Tamed wolves follow at 8 blocks instead of vanilla's 10 blocks
- **Proactive defense** - Wolves automatically attack hostile mobs within 20 blocks (zombies, skeletons, creepers, spiders, endermen, phantoms, pillagers, blazes, witches, ravagers, and more)
- **Priority system** - Wolves prioritize defending the player from attackers, then attack nearby hostile mobs
- **Preserved features** - All vanilla mechanics remain intact (sitting, breeding, collar dyeing, healing)

### Wolf Leveling System

Tamed wolves gain experience and level up as they kill hostile mobs, increasing their health, attack damage, and size.

**Level Progression:**
- **Level 1** (Base): 20 HP, 4 damage, 1.0x scale
- **Level 2** (Veteran): 30 HP, 6 damage, 1.15x scale (at 5 kills)
- **Level 3** (Elite): 40 HP, 8 damage, 1.3x scale (at 15 kills)

**Implementation:**
- **Behavior Pack:** `behavior_packs/MinecraftRaids/entities/wolf.json` - Component groups for each level
- **Service:** `scripts/core/features/WolfLevelingService.ts` - Kill tracking and level calculation
- **Initializer:** `scripts/core/initialization/WolfLevelingInitializer.ts` - Event listener for kills
- **Tests:** `scripts/gametests/WolfLevelingGameTest.ts` - 6 GameTests validating mechanics

**Testing Guide:**

See [TESTING.md](./TESTING.md) for comprehensive testing guide including:
- Unit test procedures
- GameTest examples and commands
- Manual wolf leveling testing checklist

Quick test:
1. Deploy: `npm run local-deploy`
2. Tame a wolf with bones
3. Kill 5 hostile mobs near the wolf
4. Watch for level-up notification and wolf size increase
5. GameTest validation: `/gametest run MinecraftRaids:wolfCanReachLevel2`

**Key Components in wolf.json:**
- `minecraft:wolf_level_1/2/3` - Component groups with stats for each level
- `minecraftraids:level_up_to_2/3` - Events triggered when thresholds reached
- `minecraft:scale` - Size adjustment per level (1.0x → 1.15x → 1.3x)

## Adding New Features

### 1. Create an Initializer (if feature needs startup logic)

```typescript
// scripts/core/initialization/MyFeatureInitializer.ts
import { IInitializer } from "./IInitializer";

export class MyFeatureInitializer implements IInitializer {
  initialize(): void {
    // Your initialization logic
    system.beforeEvents.playerSpawn.subscribe((event) => {
      // Feature logic
    });
  }
}
```

### 2. Register in main.ts

Add to the initializers array (around line 33):
```typescript
const initializers: IInitializer[] = [
  new WelcomeInitializer(messageProvider),
  new MyFeatureInitializer(),  // Add here
];
```

### 3. Add Tests

**For pure logic (Unit Test):**
```typescript
// scripts/core/myModule/myModule.test.ts
import { describe, it, expect } from "vitest";
import { myFunction } from "./myModule";

describe("myFunction", () => {
  it("should do something", () => {
    expect(myFunction()).toBe(expected);
  });
});
```

**For Minecraft features (GameTest):**
```typescript
// scripts/gametests/MyFeatureGameTest.ts
import * as gametest from "@minecraft/server-gametest";

export function myFeatureTest(test: gametest.Test) {
  // Test your feature
  test.assert(condition, "Error message");
  test.succeed();
}

gametest.register("MinecraftRaids", "myFeature", myFeatureTest);
```

Then import in `scripts/main.ts`:
```typescript
import "./gametests/MyFeatureGameTest";
```

## Build System (just-scripts)

The project uses `@minecraft/core-build-tasks` configured in `just.config.ts`:

- **Entry point:** `scripts/main.ts`
- **Bundle output:** `dist/scripts/main.js`
- **External modules (not bundled):** `@minecraft/server`, `@minecraft/server-ui`, `@minecraft/server-gametest`
- **Source maps:** Enabled (`dist/debug/`)
- **Watch target:** `scripts/**/*.ts`, `behavior_packs/**/*.{json,lang,png}`, `resource_packs/**/*.{json,lang,png}`

## TypeScript Configuration

- **Target:** ES6
- **Module:** ES2020
- **Strict mode:** Enabled (no `any` without annotation)
- **Source maps:** Enabled for debugging
- **No unused variables/parameters:** Enforced

Key exclude patterns:
- `**/*.test.ts` - Unit tests not bundled
- `lib/`, `dist/`, `node_modules/` - Output and dependencies

## Debugging

### Unit Test Errors
If you see `Failed to resolve entry for package "@minecraft/server"`:
- The test file imports Minecraft APIs
- Convert to GameTest or refactor to not use Minecraft APIs
- Only unit test pure logic

### GameTest Not Running
1. Enable GameTest Framework: Settings → Experiments → GameTest Framework
2. Deploy: `npm run local-deploy`
3. Check if test is registered: `/gametest list`
4. Verify file is imported in `main.ts`

### Local Deploy Issues
- `npm run local-deploy` watches files and auto-rebuilds
- Output goes to Minecraft's development pack folder
- Reload world to see changes
- Check Content Log (Settings → Creator) for errors

## Key Files Reference

| File | Purpose |
|------|---------|
| `scripts/main.ts` | Entry point, composition root, initialization orchestration |
| `scripts/core/messaging/MessageProvider.ts` | Message system implementation |
| `scripts/core/initialization/IInitializer.ts` | Interface for all feature initializers |
| `just.config.ts` | Build configuration (bundle, copy, package tasks) |
| `vitest.config.ts` | Unit test configuration |
| `tsconfig.json` | TypeScript compiler options |
| `behavior_packs/MinecraftRaids/manifest.json` | Pack metadata and dependencies |
| `resource_packs/MinecraftRaids/texts/en_US.lang` | Localization strings |

## Common Development Tasks

### Making Quick Changes
```bash
npm run local-deploy
# Edit files, save, auto-rebuilds and deploys
# Reload Minecraft world to see changes
```

### Testing Changes
```bash
# Unit tests (fast)
npm test:watch

# In-game tests
npm run local-deploy
# In Minecraft: /gametest run MinecraftRaids:testName

# Full validation
npm run lint && npm test
```

### Debugging TypeScript
- Uncomment `// debugger;` in code
- Run with `npm test -- --inspect-brk`
- Or check `dist/debug/` for source maps

### Packaging for Distribution
```bash
npm run mcaddon
# Creates `dist/packages/MinecraftRaids.mcaddon` for sharing
```

## Environment Setup

The `.env` file contains:
```
PROJECT_NAME=MinecraftRaids
```

This is loaded by `just.config.ts` via `setupEnvironment()` and used in build tasks to determine pack folders.

## Pre-commit Checklist

Before committing code:
```bash
npm run lint      # Fix any style issues
npm test          # Ensure unit tests pass
npm run build     # Verify build succeeds
```

Note: `npm run local-deploy` is a long-running watch task, not suitable for CI/CD.

## Reference Materials

The `reference/` directory contains sample code and documentation from official Microsoft sources - not part of the actual application. Use this folder for:

- **Looking up examples** when implementing new features
- **Understanding Minecraft API patterns** from official samples
- **Cross-referencing different approaches** to solve problems

### Folder Contents

**`reference/minecraft-scripting-samples/`** (Primary Reference)
- Official Microsoft Minecraft scripting samples
- Best source for this project's coding style and patterns
- Includes examples like:
  - `ts-starter/` - TypeScript starter template
  - `custom-components/`, `custom-items/`, `custom-sounds/` - Feature examples
  - `howto-gallery/` - How-to guides for common tasks
  - `build-challenge/` - Real-world building example
  - `script-box/` - Advanced scripting examples

**`reference/minecraft-samples/`**
- Comprehensive behavior pack and resource pack examples
- Contains various add-on types (blocks, items, entities, etc.)
- Note: Mix of versions - verify examples are for 1.21+ before copying

**`reference/bedrock-wiki/`**
- Bedrock Wiki documentation (git clone)
- Technical reference material
- Offline copy for quick lookups

### Important Notes

- **Version-specific:** Most reference code targets multiple Minecraft versions. **Always verify examples are for 1.21+** before implementing
- **Inspiration only:** Don't copy reference code directly without understanding it
- **This project's style:** `minecraft-scripting-samples/` best matches the architecture and patterns used here
- **Not production code:** Reference samples prioritize clarity over production concerns

### When to Use Reference

| Scenario | Where to Look |
|----------|---------------|
| How to implement a specific game mechanic | `minecraft-scripting-samples/howto-gallery/` |
| Entity or block creation patterns | `minecraft-samples/` |
| Message formatting or utilities | `minecraft-scripting-samples/` |
| TypeScript setup or build configuration | `minecraft-scripting-samples/ts-starter/` |
| GameTest examples | `minecraft-scripting-samples/` |

## References

- [Minecraft Creator Documentation](https://learn.microsoft.com/en-us/minecraft/creator/)
- [Minecraft Scripting Samples (GitHub)](https://github.com/microsoft/minecraft-scripting-samples)
- [Bedrock Wiki - GameTest](https://wiki.bedrock.dev/scripting/gametest/gametest-intro.html)
- [TESTING.md](./TESTING.md) - Comprehensive testing guide
- [README.md](./README.md) - Full project documentation
