import { access, readFile } from 'node:fs/promises';

const requiredPaths = [
  'scripts/fetch-palworld-data.mjs',
  'scripts/build-provenance.mjs',
  'scripts/verify-data.mjs',
  'scripts/build-static-api.mjs',
  'ontology/project.yaml',
  'index.html',
  'public/embed/breed/index.html',
  '.github/workflows/deploy-pages.yml',
  'docs/architecture/canonical-flow.md',
];

for (const path of requiredPaths) {
  await access(path);
}

const readme = await readFile('README.md', 'utf8');
for (const marker of ['配合検索', '公開API', 'ontology/project.yaml']) {
  if (!readme.includes(marker)) {
    throw new Error(`README canonical contract missing marker: ${marker}`);
  }
}

try {
  await access('.github/workflows/weekly-repo-research.yml');
  throw new Error('weekly-repo-research.yml is outside the canonical product flow');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

console.log('PAL ATLAS repository ratchet: PASS');
