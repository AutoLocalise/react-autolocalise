import typescript from "@rollup/plugin-typescript";

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
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "dist/server",
      rootDir: "src",
      declarationMap: false,
    }),
    // Custom plugin to fix the server index.d.ts
    {
      name: "fix-server-declarations",
      async writeBundle() {
        // Copy the correct declarations from server/index.d.ts to index.d.ts
        const { readFileSync, writeFileSync, existsSync } = await import("fs");
        const { join } = await import("path");
        const { fileURLToPath } = await import("url");
        const { dirname } = await import("path");

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);

        const correctDeclarations = join(
          __dirname,
          "dist/server/server/index.d.ts"
        );
        const targetDeclarations = join(__dirname, "dist/server/index.d.ts");

        if (existsSync(correctDeclarations)) {
          const content = readFileSync(correctDeclarations, "utf8");
          writeFileSync(targetDeclarations, content);
        }
      },
    },
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
