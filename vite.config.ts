import { defineConfig } from 'vite';

// base './' 讓 build 結果可以直接放到 GitHub Pages 子路徑
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 700 }, // three.js 本身約 550 kB
});
