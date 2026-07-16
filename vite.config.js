import { defineConfig } from 'vite';

const [, repository = ''] = (process.env.GITHUB_REPOSITORY || '').split('/');

export default defineConfig({
  base: repository ? `/${repository}/` : '/',
});
