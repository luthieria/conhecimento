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
      
      if (fs.existsSync(indexPath)) {
        const indexContent = fs.readFileSync(indexPath, 'utf-8');
        if (indexContent.includes('bookHidden: true')) hidden = true;
        if (indexContent.includes('bookHideChildren: true')) hideChildren = true;
        
        const titleMatch = indexContent.match(/^title:\s*["']?([^"'\n]+)["']?/m);
        if (titleMatch) title = titleMatch[1];
        
        const weightMatch = indexContent.match(/^weight:\s*(-?\d+)/m);
        if (weightMatch) weight = parseInt(weightMatch[1], 10);
      }
      
      if (hidden) continue;
      
      if (hideChildren) {
        result.push({
          name: title,
          type: 'folder-link',
          path: path.relative(basePath, indexPath).replace(/\\/g, '/'),
          weight
        });
      } else {
        const children = getFiles(fullPath, basePath);
        if (children.length > 0) {
          result.push({
            name: title,
            type: 'directory',
            path: path.relative(basePath, fullPath).replace(/\\/g, '/'),
            children,
            weight
          });
        }
      }
    } else if (file.endsWith('.md')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('bookHidden: true')) continue;
      
      let title = file.replace('.md', '');
      let weight = 999;
      
      const titleMatch = content.match(/^title:\s*["']?([^"'\n]+)["']?/m);
      if (titleMatch) title = titleMatch[1];
        
      const weightMatch = content.match(/^weight:\s*(-?\d+)/m);
      if (weightMatch) weight = parseInt(weightMatch[1], 10);
      
      result.push({
        name: title,
        type: 'file',
        path: path.relative(basePath, fullPath).replace(/\\/g, '/'),
        weight
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
          const basePath = 'd:/Coding/Repositories/amethyst/content/Notas'
          
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
            if(!filePath) return res.end('Path missing');
            const fullPath = path.join(basePath, filePath);
            
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              res.setHeader('Content-Type', 'text/plain');
              res.end(content);
            } catch(e) {
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
                } catch(e) {
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
                } catch(e) {
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
