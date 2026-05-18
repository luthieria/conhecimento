// @ts-nocheck
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function getFiles(dir, basePath) {
  const result = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === '.DS_Store' || file === '.obsidian' || file.startsWith('.git')) continue;

    // Handled manually for directories, completely hidden from files
    if (file === '_index.md') continue;

    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const indexPath = path.join(fullPath, '_index.md');
      let title = file;
      let weight = 999;
      let hideChildren = false;
      let hidden = false;
      let icon = null;

      if (fs.existsSync(indexPath)) {
        const indexContent = fs.readFileSync(indexPath, 'utf-8');
        if (indexContent.includes('bookHidden: true')) hidden = true;
        if (indexContent.includes('bookHideChildren: true')) hideChildren = true;

        const titleMatch = indexContent.match(/^title:\s*["']?([^"'\n]+)["']?/m);
        if (titleMatch) title = titleMatch[1];

        const weightMatch = indexContent.match(/^weight:\s*(-?\d+)/m);
        if (weightMatch) weight = parseInt(weightMatch[1], 10);

        const iconMatch = indexContent.match(/^icon:\s*["']?([^"'\n]+)["']?/m);
        if (iconMatch) icon = iconMatch[1];
      }

      if (hidden) continue;

      const children = getFiles(fullPath, basePath);

      if (hideChildren) {
        result.push({
          name: title,
          type: 'folder-link',
          path: path.relative(basePath, indexPath).replace(/\\/g, '/'),
          weight,
          icon,
          children
        });
      } else {
        if (children.length > 0) {
          result.push({
            name: title,
            type: 'directory',
            path: path.relative(basePath, fullPath).replace(/\\/g, '/'),
            indexPath: fs.existsSync(indexPath) ? path.relative(basePath, indexPath).replace(/\\/g, '/') : null,
            children,
            weight,
            icon
          });
        }
      }
    } else if (file.endsWith('.md')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('bookHidden: true')) continue;

      let title = file.replace('.md', '');
      let weight = 999;
      let icon = null;

      const titleMatch = content.match(/^title:\s*["']?([^"'\n]+)["']?/m);
      if (titleMatch) title = titleMatch[1];

      const weightMatch = content.match(/^weight:\s*(-?\d+)/m);
      if (weightMatch) weight = parseInt(weightMatch[1], 10);

      const iconMatch = content.match(/^icon:\s*["']?([^"'\n]+)["']?/m);
      if (iconMatch) icon = iconMatch[1];

      result.push({
        name: title,
        type: 'file',
        path: path.relative(basePath, fullPath).replace(/\\/g, '/'),
        weight,
        icon
      });
    }
  }

  result.sort((a, b) => {
    if (a.weight !== b.weight) return a.weight - b.weight;
    return a.name.localeCompare(b.name);
  });

  return result;
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-fs-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const basePath = 'd:/Coding/Repositories/amethyst/content'
          const staticPath = 'd:/Coding/Repositories/amethyst/static'
          const rootPath = 'd:/Coding/Repositories/amethyst'

          // Serve images and assets from Amethyst
          const isAsset = /\.(png|jpe?g|gif|svg|webp|pdf|docx?|xlsx?|json)$/i.test(req.url);
          if (isAsset) {
            const urlPath = req.url.split('?')[0];
            const decodedUrl = decodeURIComponent(urlPath);
            
            // Paths to try in order:
            // 1. Static folder
            // 2. Content folder
            // 3. Root folder (for /assets/...)
            const pathsToTry = [
              path.join(staticPath, decodedUrl),
              path.join(basePath, decodedUrl),
              path.join(rootPath, decodedUrl)
            ];

            console.log(`[Asset] Request: ${req.url}`);
            
            for (const fullPath of pathsToTry) {
              try {
                if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                  console.log(`[Asset] Found: ${fullPath}`);
                  const ext = path.extname(fullPath).toLowerCase().slice(1);
                  const mimeTypes = {
                    'png': 'image/png',
                    'jpg': 'image/jpeg',
                    'jpeg': 'image/jpeg',
                    'gif': 'image/gif',
                    'svg': 'image/svg+xml',
                    'webp': 'image/webp',
                    'pdf': 'application/pdf',
                    'json': 'application/json'
                  };
                  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
                  res.end(fs.readFileSync(fullPath));
                  return;
                }
              } catch (e) {
                // Ignore errors and try next path
              }
            }
            console.log(`[Asset] Not found in any of: ${pathsToTry.join(', ')}`);
          }

          if (req.url === '/api/files' && req.method === 'GET') {
            try {
              const tree = getFiles(basePath, basePath);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(tree));
            } catch (e) {
              res.statusCode = 500;
              res.end(e.toString());
            }
            return;
          }

          if (req.url?.startsWith('/api/file') && req.method === 'GET') {
            const fileUrl = new URL(req.url, `http://${req.headers.host}`);
            const filePath = fileUrl.searchParams.get('path');
            if (!filePath) return res.end('Path missing');
            const fullPath = path.join(basePath, filePath);

            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              res.setHeader('Content-Type', 'text/plain');
              res.end(content);
            } catch (e) {
              res.statusCode = 404;
              res.end('File not found');
            }
            return;
          }

          if (req.url === '/api/save' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
              try {
                const { filePath, content } = JSON.parse(body);
                const fullPath = path.join(basePath, filePath);
                fs.writeFileSync(fullPath, content);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e.toString() }));
              }
            });
            return;
          }

          if (req.url === '/api/create' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
              try {
                const { directory, filename } = JSON.parse(body);
                const fullDirPath = path.join(basePath, directory || '');
                if (!fs.existsSync(fullDirPath)) fs.mkdirSync(fullDirPath, { recursive: true });

                const safeFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
                const fullFilePath = path.join(fullDirPath, safeFilename);

                const initialContent = `---\ntitle: ${filename.replace('.md', '')}\n---\n\n`;
                if (!fs.existsSync(fullFilePath)) {
                  fs.writeFileSync(fullFilePath, initialContent);
                }

                res.setHeader('Content-Type', 'application/json');
                // We need to return the path relative to basePath just like file reads expect
                const relativePath = path.relative(basePath, fullFilePath).replace(/\\/g, '/');
                res.end(JSON.stringify({ success: true, path: relativePath }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e.toString() }));
              }
            });
            return;
          }

          next();
        });
      }
    }
  ],
})
