import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/opinet-price-card.js'],
  bundle: true,
  minify: false,
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
  outfile: 'opinet-price-card.js',
  loader: { '.css': 'text' },
});

console.log('Build complete → opinet-price-card.js');
