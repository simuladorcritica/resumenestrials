import fs from 'node:fs';

const jsSources = [
  'future-experience.js',
  'global-search.js',
  'future-experience-final.js',
  'future-experience-fix-v4.js',
  'future-experience-fix-v4-compat.js',
  'legacy-unifier-v4.js',
  'reader-endmatter-v7.js',
  'reader-ui-v8.js',
  'home-downloads-v8.js',
  'reader-controls-v9.js',
];

const cssSources = [
  'future-experience.css',
  'future-experience-patch.css',
  'global-search.css',
];

function bundle(sources, target, comment) {
  const output = sources.map((source) => {
    const content = fs.readFileSync(source, 'utf8').trim();
    return `${comment} ${source} */\n${content}`;
  }).join('\n\n');
  fs.writeFileSync(target, `/* GENERATED FILE. Run: node scripts/build-site-runtime.mjs */\n${output}\n`, 'utf8');
}

bundle(jsSources, 'site-runtime.js', '/* source:');
bundle(cssSources, 'site-runtime.css', '/* source:');
console.log(`Runtime generado: ${jsSources.length} JS -> site-runtime.js; ${cssSources.length} CSS -> site-runtime.css.`);
