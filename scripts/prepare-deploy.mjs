import { existsSync, unlinkSync } from 'node:fs';
import { resolve, sep } from 'node:path';

// A local, unused working file must never enter the public Workers asset bundle.
// Keep the source untouched; remove only its generated copy before deployment.
const assetRoot = resolve('dist/client');
const excluded = resolve(assetRoot, 'create-examples/image-styles/cute-giraffe-watercolor-background-removed.png');
if (!excluded.startsWith(assetRoot + sep)) throw new Error('Invalid deploy exclusion path');
if (existsSync(excluded)) unlinkSync(excluded);
