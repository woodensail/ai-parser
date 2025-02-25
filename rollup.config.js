import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

export default {
  treeshake: true,
  input: "src/index.ts", // 入口文件
  output: [
    {
      file: "dist/index.cjs", // CommonJS 式
      format: "cjs",
      sourcemap: true
    },
    {
      file: "dist/index.mjs", // ES 模块格式
      format: "esm",
      sourcemap: true
    }
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true, // 生成 .d.ts 文件
      declarationDir: "dist" // 将声明文件放在 dist 目录
    })
  ]
};