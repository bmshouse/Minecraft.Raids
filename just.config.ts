import { argv, parallel, series, task, tscTask } from "just-scripts";
import {
  bundleTask,
  BundleTaskParameters,
  CopyTaskParameters,
  STANDARD_CLEAN_PATHS,
  ZipTaskParameters,
  cleanCollateralTask,
  cleanTask,
  copyTask,
  coreLint,
  mcaddonTask,
  setupEnvironment,
  zipTask,
  copyFiles,
  DEFAULT_CLEAN_DIRECTORIES,
  getOrThrowFromProcess,
  watchTask,
} from "@minecraft/core-build-tasks";
import path from "path";

// Setup env variables
setupEnvironment(path.resolve(__dirname, ".env"));
const projectName = getOrThrowFromProcess("PROJECT_NAME");

// Production bundle (no GameTest - no Beta APIs required)
const bundleTaskOptions: BundleTaskParameters = {
  entryPoint: path.join(__dirname, "./scripts/main.ts"),
  external: ["@minecraft/server", "@minecraft/server-ui"],
  outfile: path.resolve(__dirname, "./dist/scripts/main.js"),
  minifyWhitespace: false,
  sourcemap: true,
  outputSourcemapPath: path.resolve(__dirname, "./dist/debug"),
};

// Development bundle (includes GameTest - requires Beta APIs)
const bundleTaskDevOptions: BundleTaskParameters = {
  entryPoint: path.join(__dirname, "./scripts/main-dev.ts"),
  external: ["@minecraft/server", "@minecraft/server-ui", "@minecraft/server-gametest"],
  outfile: path.resolve(__dirname, "./dist/scripts/main.js"),
  minifyWhitespace: false,
  sourcemap: true,
  outputSourcemapPath: path.resolve(__dirname, "./dist/debug"),
};

const copyTaskOptions: CopyTaskParameters = {
  copyToBehaviorPacks: [`./behavior_packs/${projectName}`],
  copyToScripts: ["./dist/scripts"],
  copyToResourcePacks: [`./resource_packs/${projectName}`],
};

const mcaddonTaskOptions: ZipTaskParameters = {
  ...copyTaskOptions,
  outputFile: `./dist/packages/${projectName}.mcaddon`,
};

// Lint
task("lint", coreLint(["scripts/**/*.ts"], argv().fix));

// Build
task("typescript", tscTask());
task("bundle", bundleTask(bundleTaskOptions));
task("bundle:dev", bundleTask(bundleTaskDevOptions));
task("build", series("typescript", "bundle"));
task("build:dev", series("typescript", "bundle:dev"));

// Clean
task("clean-local", cleanTask([...DEFAULT_CLEAN_DIRECTORIES]));
task("clean-collateral", cleanCollateralTask(STANDARD_CLEAN_PATHS));
task("clean", parallel("clean-local", "clean-collateral"));

// Package
task("copyArtifacts", copyTask(copyTaskOptions));
task("package", series("clean-collateral", "copyArtifacts"));

// Manifest generation for dev vs prod builds
// Source manifests (tracked in version control):
//   - manifest.prod.json (production - no Beta APIs)
//   - manifest.dev.json (development - with GameTest)
// Generated manifest (gitignored):
//   - manifest.json (copied from prod or dev during build)
task("generate-dev-manifest", () => {
  const fs = require("fs");
  const devManifest = path.join(__dirname, `./behavior_packs/${projectName}/manifest.dev.json`);
  const manifest = path.join(__dirname, `./behavior_packs/${projectName}/manifest.json`);

  fs.copyFileSync(devManifest, manifest);
  console.log("✓ Generated manifest.json from manifest.dev.json (includes GameTest)");
});

task("generate-prod-manifest", () => {
  const fs = require("fs");
  const prodManifest = path.join(__dirname, `./behavior_packs/${projectName}/manifest.prod.json`);
  const manifest = path.join(__dirname, `./behavior_packs/${projectName}/manifest.json`);

  fs.copyFileSync(prodManifest, manifest);
  console.log("✓ Generated manifest.json from manifest.prod.json (no Beta APIs)");
});

// Local Deploy used for deploying local changes directly to output via the bundler. It does a full build and package first just in case.
// Uses build:dev to include GameTest files and generates dev manifest
task(
  "local-deploy",
  watchTask(
    [
      "scripts/**/*.ts",
      "behavior_packs/**/*.{json,lang,png,mcstructure}",
      "resource_packs/**/*.{json,lang,png}",
    ],
    series("generate-dev-manifest", "clean-local", "build:dev", "package")
  )
);

// Mcaddon - generates production manifest (no Beta APIs)
task("createMcaddonFile", mcaddonTask(mcaddonTaskOptions));
task("mcaddon", series("generate-prod-manifest", "clean-local", "build", "createMcaddonFile"));
