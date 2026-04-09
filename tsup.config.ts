import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'find-commits': 'src/index.ts'
  },
  format: ['cjs'],
  target: 'node24',
  outDir: 'dist',
  clean: true,
  sourcemap: false,
  treeshake: true,
  splitting: false,
  banner: {
    js: '// find-commits - https://github.com/Mintonne/find-commits'
  }
})
