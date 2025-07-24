import { $ } from "bun";
import path from "path";

function printHelp() {
  console.log(`
Usage: bun link.ts [options] <fe-folder>

Options:
  --help     Show this help message

Arguments:
  fe-folder  Path to the other project

Example:
  bun link.ts /path/to/project
`);
  process.exit(0);
}

// Check for help flag or no arguments
if (process.argv.includes("--help") || process.argv.length < 3) {
  printHelp();
}

const targetProject = process.argv[2];

// Validate feFolder is provided
if (!targetProject) {
  console.error("Error: project-folder argument is required");
  printHelp();
  process.exit(1);
}

const targetDir = path.join(
  targetProject,
  "node_modules",
  "@ricsam/selection-manager",
);

await $`
    rm -rf ${targetDir}
    mkdir -p ${targetDir}
`;

await Bun.file(path.join(targetDir, "package.json")).write(
  JSON.stringify({
    name: "@ricsam/selection-manager",
    version: "0.0.1",
    main: "src/lib.ts",
    types: "src/lib.ts",
    type: "module",
  }),
);

await $`
  ln -s ${path.join(__dirname, "src")} ${path.join(targetDir, "src")}
  rm -rf ${path.join(__dirname, "node_modules", "react")}
  rm -rf ${path.join(
    targetProject,
    "node_modules",
    ".vite"
  )}
  ln -s ${path.join(targetProject, "node_modules", "react")} ${path.join(
    __dirname,
    "node_modules",
    "react",
  )}
`;
