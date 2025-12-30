import typescript from "@rollup/plugin-typescript";
import replace from "@rollup/plugin-replace";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json (single source of truth)
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "package.json"), "utf-8")
);
const VERSION = packageJson.version;

const external = [
  "react",
  "react-dom",
  "react-native",
  "@react-native-async-storage/async-storage",
  "next",
];

// Main module build configuration
const mainConfig = {
  input: "src/index.ts",
  external,
  plugins: [
    replace({
      __VERSION__: JSON.stringify(VERSION),
      preventAssignment: true,
    }),
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "dist",
      exclude: ["src/server/**/*"], // Exclude server files from main build
      declarationMap: false,
    }),
  ],
  output: [
    {
      file: "dist/index.cjs",
      format: "cjs",
      sourcemap: true,
      exports: "named",
    },
    {
      file: "dist/index.mjs",
      format: "es",
      sourcemap: true,
      exports: "named",
    },
  ],
};

// Server module build configuration
const serverConfig = {
  input: "src/server/index.ts",
  external,
  plugins: [
    replace({
      __VERSION__: JSON.stringify(VERSION),
      preventAssignment: true,
    }),
    typescript({
      tsconfig: "./tsconfig.json",
      compilerOptions: {
        rootDir: "src",
        declaration: true,
        declarationDir: "dist/server",
        declarationMap: false,
      },
    }),
  ],
  output: [
    {
      file: "dist/server/index.cjs",
      format: "cjs",
      sourcemap: true,
      exports: "named",
    },
    {
      file: "dist/server/index.mjs",
      format: "es",
      sourcemap: true,
      exports: "named",
    },
  ],
};

export default [mainConfig, serverConfig];
