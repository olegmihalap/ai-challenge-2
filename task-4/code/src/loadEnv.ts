import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

/**
 * Load `.env` for the MCP server. `import.meta.url` lives under `task-4/code/dist` or
 * `task-4/code/src`, so the package root is always one level up (`task-4/code/`).
 *
 * Order:
 * 1. `task-4/.env` — shared / legacy location next to `task.md`
 * 2. `task-4/code/.env` — local overrides (wins on duplicate keys)
 */
export function loadDotenvFiles(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const codePackageDir = path.join(here, "..");
  const task4RootEnv = path.join(codePackageDir, "..", ".env");
  const codePackageEnv = path.join(codePackageDir, ".env");

  dotenv.config({ path: task4RootEnv, quiet: true });
  dotenv.config({ path: codePackageEnv, quiet: true, override: true });
}
