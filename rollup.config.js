import typescript from "@rollup/plugin-typescript";

// Configuration shared between both builds
const commonConfig = {
  external: [
    "react",
    "react-dom",
    "react-native",
    "@react-native-async-storage/async-storage",
    "next",
  ],
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "dist",
    }),
  ],
};

// Main module build configuration
const mainConfig = {
  ...commonConfig,
  input: "src/index.ts",
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
  ...commonConfig,
  input: "src/server/index.ts",
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
