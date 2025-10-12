import typescript from '@rollup/plugin-typescript';
import packageJson from './package.json' with { type: "json" };
import dts from "rollup-plugin-dts";
import resolve from '@rollup/plugin-node-resolve';
import copy from 'rollup-plugin-copy';
import json from '@rollup/plugin-json';
const config = [
  {
    input: 'src/app.ts',
    output: {
      file: 'lib/bundle/hydra-consent-node.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    external: packageJson.dependencies ? Object.keys(packageJson.dependencies) : [],
    plugins: [typescript(), resolve(), json(),
    copy({
        targets: [
          { src: 'views/**/*', dest: 'lib/bundle/views' } // Copy the 'views' folder and its contents
        ],
        flatten: false // Preserve the directory structure within 'views'
      })
    ]
  }
];

export default config;
