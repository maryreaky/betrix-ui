const fs = require('fs');
const path = require('path');

const root = process.cwd();
const out = path.join(root, 'dist');

function copyFile(src, dest) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(src, dest); }

try {
  // clean out
  if (fs.existsSync(out)) fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  // copy root index.html
  const index = path.join(root, 'index.html');
  if (fs.existsSync(index)) copyFile(index, path.join(out, 'index.html'));

  // copy common static folders if present
  ['public','assets','static'].forEach(dir => {
    const src = path.join(root, dir);
    if (fs.existsSync(src)) {
      const walk = (p, destBase) => {
        const items = fs.readdirSync(p);
        items.forEach(name => {
          const item = path.join(p, name);
          const rel = path.relative(src, item);
          const dest = path.join(destBase, rel);
          if (fs.lstatSync(item).isDirectory()) { fs.mkdirSync(dest, { recursive: true }); walk(item, destBase); }
          else copyFile(item, dest);
        });
      };
      walk(src, path.join(out, dir));
    }
  });

  console.log('Static build complete -> dist/');
  process.exit(0);
} catch (err) {
  console.error('Build failure:', err);
  process.exit(2);
}
