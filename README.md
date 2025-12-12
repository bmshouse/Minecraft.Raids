# Minecraft Raids

A modern TypeScript-based behavior pack for Minecraft Bedrock Edition v1.21+ that demonstrates best practices in software architecture.

## Features

- **TypeScript Support**: Fully typed codebase with strict mode enabled
- **i18n (Internationalization)**: Multi-language message system
- **SOLID Principles**: Architecture following Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion principles
- **DRY (Don't Repeat Yourself)**: Centralized message management and initialization patterns
- **Hybrid Testing**: Unit tests (Vitest) for pure logic + GameTest for Minecraft-specific features
- **Microsoft Best Practices**: Follows official Minecraft scripting samples and recommendations
- **Modern Build System**: Uses just-scripts for building and bundling
- **Enhanced Guard Wolves**: Tamed wolves follow more closely (8 blocks) and automatically defend against hostile mobs

## Project Structure

```
Minecraft.Raids/
├── behavior_packs/MinecraftRaids/      # Behavior pack definition
│   ├── manifest.json                    # Pack metadata
│   └── scripts/                         # Compiled JavaScript output
├── resource_packs/MinecraftRaids/       # Resource pack definition
│   ├── manifest.json                    # Pack metadata
│   └── texts/
│       └── en_US.lang                   # Localization strings
├── scripts/                             # TypeScript source code
│   ├── core/
│   │   ├── initialization/              # Pack initialization system
│   │   │   ├── IInitializer.ts
│   │   │   └── WelcomeInitializer.ts
│   │   └── messaging/                   # i18n message system
│   │       ├── IMessageProvider.ts
│   │       ├── MessageProvider.ts
│   │       └── MessageProvider.test.ts  # Unit tests (Vitest)
│   ├── gametests/                       # In-game GameTest tests
│   │   ├── WelcomeGameTest.ts
│   │   └── MessageProviderGameTest.ts
│   └── main.ts                          # Entry point
├── test/                                # Test infrastructure
│   └── setup/                           # Test configuration
├── package.json                         # Dependencies and scripts
├── tsconfig.json                        # TypeScript configuration
├── just.config.ts                       # Build configuration
├── vitest.config.ts                     # Vitest configuration
├── eslint.config.mjs                    # Linting configuration
├── TESTING.md                           # Testing guide
└── README.md                            # This file
```

## Architecture Highlights

### SOLID Principles

1. **Single Responsibility**: Each class has one reason to change
   - `MessageProvider`: Only manages messages
   - `WelcomeInitializer`: Only handles welcome logic

2. **Open/Closed**: Open for extension, closed for modification
   - New initializers can be added without modifying existing code
   - Message system can be extended with new providers

3. **Liskov Substitution**: Derived classes are substitutable
   - Any `IInitializer` can be used interchangeably

4. **Interface Segregation**: Clients depend on focused interfaces
   - `IMessageProvider`: Message operations only
   - `IInitializer`: Initialization operations only

5. **Dependency Inversion**: Depend on abstractions, not concretions
   - `WelcomeInitializer` depends on `IMessageProvider` interface
   - Main orchestrates dependencies via composition

### DRY (Don't Repeat Yourself)

- **Centralized Messages**: All messages defined in `MessageProvider` and `en_US.lang`
- **Reusable Patterns**: Initializer pattern allows extensibility
- **No Duplication**: Single source of truth for each feature

### Testing Strategy

This project follows **Microsoft's recommended testing approach** for Minecraft Bedrock scripts:

1. **Unit Tests (Vitest)** - Pure TypeScript logic
   - `MessageProvider.test.ts` - Message system functionality
   - Fast, isolated, run offline

2. **GameTest (In-Game)** - Minecraft-specific features
   - `WelcomeGameTest.ts` - Welcome system validation
   - `MessageProviderGameTest.ts` - Provider in-game validation
   - Runs IN Minecraft to validate real behavior

3. **Manual Testing** - User experience
   - Use `npm run local-deploy` for rapid iteration
   - Test in actual Minecraft client

See [TESTING.md](TESTING.md) for complete testing guide.

## Setup

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

```bash
cd Minecraft.Raids
npm install
```

### Build Commands

```bash
# Development workflow
npm run build           # Build TypeScript and bundle (one-time)
npm run local-deploy    # Watch mode - auto-rebuild and deploy on file changes
npm run test            # Run unit tests (Vitest)
npm run test:watch      # Run tests in watch mode
npm run lint            # Lint TypeScript code
npm run clean           # Clean build artifacts

# Distribution
npm run mcaddon         # Create .mcaddon package file for sharing
```

### Testing

```bash
# Unit Tests (Pure Logic)
npm run test            # Run all unit tests once
npm run test:watch      # Run tests in watch mode for development
npm run test:ui         # Open interactive test UI dashboard

# GameTests (In-Game)
# 1. Enable GameTest Framework in Minecraft settings
# 2. Deploy: npm run local-deploy
# 3. Load world with behavior pack
# 4. Run: /gametest run MinecraftRaids:welcomeMessage
#        /gametest run MinecraftRaids:messageProvider
```

## Development

### Project Patterns

#### 1. Dependency Injection

```typescript
// Good: Dependencies injected through constructor
const welcomeInitializer = new WelcomeInitializer(messageProvider);

// Allows easy testing and swapping implementations
```

#### 2. Composition Root

```typescript
// All dependencies created and wired in one place
const messageProvider = new MessageProvider();
const initializers = [new WelcomeInitializer(messageProvider)];
```

#### 3. Interface Segregation

```typescript
// Focused interfaces for specific concerns
interface IMessageProvider { ... }
interface IInitializer { ... }
```

### Adding New Features

#### 1. Create an Initializer

```typescript
// scripts/core/initialization/MyFeatureInitializer.ts
import { IInitializer } from "./IInitializer";

export class MyFeatureInitializer implements IInitializer {
  initialize(): void {
    // Your initialization logic
  }
}
```

#### 2. Register in main.ts

```typescript
const initializers: IInitializer[] = [
  new WelcomeInitializer(messageProvider),
  new MyFeatureInitializer(), // Add here
];
```

#### 3. Add Tests (if applicable)

**For pure logic** (utility functions, message formatting):
```typescript
// scripts/utilities/myUtils.test.ts
describe("myUtils", () => {
  it("should format correctly", () => {
    // Your unit test logic
  });
});
```

**For Minecraft features** (entity interactions, world changes):
```typescript
// scripts/gametests/MyFeatureGameTest.ts
import * as gametest from "@minecraft/server-gametest";

export function myFeatureTest(test: gametest.Test) {
  // Your in-game test logic
  test.succeed();
}

gametest.register("MinecraftRaids", "myFeature", myFeatureTest);
```

Then import in `main.ts`:
```typescript
import "./gametests/MyFeatureGameTest";
```

## Message System (i18n)

Add messages to `MessageProvider`:

```typescript
// scripts/core/messaging/MessageProvider.ts
private readonly messages: Record<string, string> = {
  "my.custom.message": "My custom message",
  // ...
};
```

Also add to resource pack:

```lang
# resource_packs/MinecraftRaids/texts/en_US.lang
my.custom.message=My custom message
```

Retrieve messages:

```typescript
const message = messageProvider.getMessage("my.custom.message");
const withFallback = messageProvider.getMessage("missing.key", "Fallback text");
```

## TypeScript Configuration

- **Target**: ES6
- **Module**: ES2020
- **Strict Mode**: Enabled
- **Source Maps**: Enabled for debugging
- **No Unused Variables**: Enforced

## Dependencies

### Runtime Dependencies
- `@minecraft/server` ^2.0.0 - Minecraft Bedrock API
- `@minecraft/server-gametest` 1.0.0-beta - GameTest framework (beta, for in-game tests)
- `@minecraft/vanilla-data` ^1.21.90 - Vanilla data types

### Dev Dependencies

- `typescript` ^5.5.4 - TypeScript compiler
- `@minecraft/core-build-tasks` ^5.5.0 - Build system
- `eslint-plugin-minecraft-linting` ^2.0.10 - Linting
- `vitest` ^2.1.0 - Unit test runner
- `@vitest/ui` ^2.1.0 - Interactive test UI

## Contributing

When contributing, maintain the established patterns:

1. Follow SOLID principles
2. Write appropriate tests:
   - Unit tests (Vitest) for pure logic
   - GameTest for Minecraft-specific features
   - See [TESTING.md](TESTING.md) for guidelines
3. Use dependency injection
4. Keep interfaces focused
5. Avoid code duplication
6. Run `npm run lint` before committing
7. Ensure `npm test` passes for unit tests

## License

This project is provided as-is for educational purposes.

## Documentation

- **[TESTING.md](TESTING.md)** - Comprehensive testing guide (unit tests, GameTest, manual testing)
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deployment and configuration guide

## Resources

- [Minecraft Creator Documentation](https://learn.microsoft.com/en-us/minecraft/creator/)
- [Minecraft Scripting Samples (GitHub)](https://github.com/microsoft/minecraft-scripting-samples)
- [Bedrock Wiki](https://wiki.bedrock.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Vitest Documentation](https://vitest.dev/)
- [GameTest Framework](https://wiki.bedrock.dev/scripting/gametest/gametest-intro.html)
