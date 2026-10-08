import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    files: ['Site web/**/*.js'],
    rules: {
      '@next/next/no-location-assign-relative-destination': 'off'
    }
  },
  globalIgnores(['.next/**','out/**','build/**','next-env.d.ts','.wrangler/**','node_modules/**','test-results/**','playwright-report/**','.agents/**','site-public/**'])
]);
