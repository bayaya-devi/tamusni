import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  globalIgnores(['.next/**','out/**','build/**','next-env.d.ts','.wrangler/**','node_modules/**','test-results/**','playwright-report/**','.agents/**','site-public/**'])
]);
