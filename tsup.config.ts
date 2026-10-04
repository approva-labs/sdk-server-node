import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],

  format: ["esm", "cjs"],

  // REMOVE: dts: true
  // ADD: This forces tsup to emit both .d.ts and .d.cts files
  dts: {
    compilerOptions: {
      moduleResolution: "node",
    },
  },

  sourcemap: true,

  clean: true,

  splitting: false,

  treeshake: true,

  target: "es2022",

  platform: "node",

  minify: false,

  outDir: "dist",

  outExtension({ format }) {
    return {
      js: format === "cjs" ? ".cjs" : ".js",
    };
  },
});
