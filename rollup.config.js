import typescript from '@rollup/plugin-typescript';
import packageJson from './package.json' with { type: "json" };
import dts from "rollup-plugin-dts";
import resolve from '@rollup/plugin-node-resolve';
import copy from 'rollup-plugin-copy';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
const config = [
  {
    input: 'src/app.ts',
    output: {
      dir: 'dist',
      entryFileNames: '[name].js',
      format: 'esm',
      sourcemap: true

    },
    external: packageJson.dependencies ? Object.keys(packageJson.dependencies) : [],
    plugins: [typescript(), json(), resolve({preferBuiltins:true, jsnext: true}), commonjs({include: ['src/app.ts', 'node_modules/**']}),
    copy({
        targets: [
          { src: 'views/**/*', dest: 'dist/views' }, // Copy the 'views' folder and its contents
          { src: 'node_modules', dest: 'dist' }

        ],
        flatten: false // Preserve the directory structure within 'views'
      })
    ]
  }
];

export default config;
