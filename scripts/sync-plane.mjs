import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const projectRootPath = fileURLToPath(new URL('..', import.meta.url));

const FILES_TO_COPY = [
  { sourcePath: 'web/index.html', destinationPath: 'extension/overlay/plane.html' },
  { sourcePath: 'web/plane.js', destinationPath: 'extension/overlay/plane.js' },
  { sourcePath: 'web/plane.css', destinationPath: 'extension/overlay/plane.css' },
];

for (const { sourcePath, destinationPath } of FILES_TO_COPY) {
  copyFileSync(projectRootPath + sourcePath, projectRootPath + destinationPath);
  console.log(`${sourcePath} → ${destinationPath}`);
}
