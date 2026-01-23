import { $ } from "bun";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Get the target triple for the current platform
function getTargetTriple(): string {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "darwin") {
    return arch === "arm64"
      ? "aarch64-apple-darwin"
      : "x86_64-apple-darwin";
  }
  if (platform === "win32") {
    return "x86_64-pc-windows-msvc";
  }
  if (platform === "linux") {
    return arch === "arm64"
      ? "aarch64-unknown-linux-gnu"
      : "x86_64-unknown-linux-gnu";
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

async function build() {
  const targetTriple = getTargetTriple();
  const isWindows = process.platform === "win32";
  const ext = isWindows ? ".exe" : "";

  const outputDir = join(
    import.meta.dir,
    "..",
    "..",
    "desktop-app",
    "src-tauri",
    "binaries"
  );

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = join(outputDir, `backend-${targetTriple}${ext}`);
  const entryPath = join(import.meta.dir, "..", "src", "index.ts");

  console.log(`Building backend for ${targetTriple}...`);
  console.log(`Output: ${outputPath}`);

  await $`bun build --compile ${entryPath} --outfile ${outputPath}`;

  console.log("Build completed successfully!");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
