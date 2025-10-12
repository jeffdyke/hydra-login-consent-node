import typescript from '@rollup/plugin-typescript';
import packageJson from './package.json' with { type: "json" };
import dts from "rollup-plugin-dts";
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
const config = [
  // {
  //   input: 'lib/app.js',
  //   output: {
  //     file: 'lib/bundle/hydra-consent-node.js',
  //     format: 'cjs',
  //     sourcemap: true,
  //   },
  //   external: packageJson.dependencies ? Object.keys(packageJson.dependencies) : [],
  //   plugins: [typescript(), resolve(), json(), commonjs({
  //         include: 'node_modules/**' // Ensure it processes modules in node_modules
  //   })]
  // // }, {
  // //   input: 'build/compiled/index.d.ts',
  // //   output: {
  // //     file: 'hydra-consent-node.d.ts',
  // //     format: 'es'
  // //   },
  // //   plugins: [dts()]

  // },
  {
    input: 'src/app.ts',
    output: {
      file: 'lib/bundle/hydra-consent-node.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    external: packageJson.dependencies ? Object.keys(packageJson.dependencies) : [],
    plugins: [typescript(), resolve(), json()]
  }
];

export default config;
