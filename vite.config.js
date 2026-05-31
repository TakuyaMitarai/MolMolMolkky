import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// NOTE: `base` must match the GitHub repository name so assets resolve on
// https://<user>.github.io/<repo>/ . Change this if the repo is renamed.
export default defineConfig({
  base: '/MolMolMolkky/',
  plugins: [vue()],
})
