/**
 * vite-plugin-lilypond.ts
 * 
 * A Vite plugin that enables serving LilyPond (.ly) files as rendered SVG
 * through the dev server. It uses the locally installed LilyPond binary 
 * to compile .ly files to SVG on-demand when requested by the browser.
 * 
 * This plugin also serves .musicxml files for Verovio's client-side rendering.
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { Plugin } from 'vite'

const LILYPOND_BIN = 'D:/Coding/Tools/lilypond/lilypond-2.26.0/bin/lilypond.exe'

// Simple in-memory cache to avoid re-rendering unchanged files
const svgCache = new Map<string, { mtime: number; svg: string }>()

export default function lilypondPlugin(): Plugin {
  return {
    name: 'vite-plugin-lilypond',
    
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        if (!url) return next()
        
        // Handle .ly file requests → compile to SVG on-the-fly
        if (url.endsWith('.ly')) {
          const decodedUrl = decodeURIComponent(url)
          
          // Try multiple source directories
          const contentBase = 'd:/Coding/Repositories/amethyst/content'
          const staticBase = 'd:/Coding/Repositories/amethyst/static'
          
          const pathsToTry = [
            path.join(contentBase, decodedUrl),
            path.join(staticBase, decodedUrl),
          ]
          
          let lyFile: string | null = null
          for (const p of pathsToTry) {
            if (fs.existsSync(p)) {
              lyFile = p
              break
            }
          }
          
          if (!lyFile) return next()
          
          try {
            const stat = fs.statSync(lyFile)
            const cached = svgCache.get(lyFile)
            
            // Return cached version if file hasn't changed
            if (cached && cached.mtime === stat.mtimeMs) {
              res.setHeader('Content-Type', 'image/svg+xml')
              res.setHeader('Cache-Control', 'no-cache')
              res.end(cached.svg)
              return
            }
            
            // Compile .ly → SVG using LilyPond
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lilypond-'))
            const baseName = path.basename(lyFile, '.ly')
            
            try {
              execSync(`"${LILYPOND_BIN}" --svg --output="${tmpDir}/${baseName}" "${lyFile}"`, {
                timeout: 30000,
                stdio: ['ignore', 'pipe', 'pipe'],
              })
              
              // LilyPond generates baseName.svg (or baseName-1.svg for multi-page)
              const svgFile = path.join(tmpDir, `${baseName}.svg`)
              const svgFile1 = path.join(tmpDir, `${baseName}-1.svg`)
              
              let svgContent: string
              if (fs.existsSync(svgFile)) {
                svgContent = fs.readFileSync(svgFile, 'utf-8')
              } else if (fs.existsSync(svgFile1)) {
                // Multi-page: concatenate all pages
                const pages: string[] = []
                let pageNum = 1
                let pageFile = path.join(tmpDir, `${baseName}-${pageNum}.svg`)
                while (fs.existsSync(pageFile)) {
                  pages.push(fs.readFileSync(pageFile, 'utf-8'))
                  pageNum++
                  pageFile = path.join(tmpDir, `${baseName}-${pageNum}.svg`)
                }
                svgContent = pages.join('\n')
              } else {
                throw new Error('LilyPond did not produce SVG output')
              }
              
              // Cache the result
              svgCache.set(lyFile, { mtime: stat.mtimeMs, svg: svgContent })
              
              res.setHeader('Content-Type', 'image/svg+xml')
              res.setHeader('Cache-Control', 'no-cache')
              res.end(svgContent)
            } finally {
              // Clean up temp directory
              fs.rmSync(tmpDir, { recursive: true, force: true })
            }
          } catch (err: any) {
            console.error(`[LilyPond] Error compiling ${lyFile}:`, err.message)
            res.statusCode = 500
            res.setHeader('Content-Type', 'text/plain')
            res.end(`LilyPond compilation error: ${err.message}`)
          }
          return
        }
        
        // Handle .musicxml / .mxl requests — serve them as-is for Verovio
        if (url.endsWith('.musicxml') || url.endsWith('.mxl') || 
            (url.endsWith('.xml') && url.includes('music'))) {
          const decodedUrl = decodeURIComponent(url)
          const contentBase = 'd:/Coding/Repositories/amethyst/content'
          const staticBase = 'd:/Coding/Repositories/amethyst/static'
          
          const pathsToTry = [
            path.join(contentBase, decodedUrl),
            path.join(staticBase, decodedUrl),
          ]
          
          for (const p of pathsToTry) {
            if (fs.existsSync(p)) {
              const content = fs.readFileSync(p)
              const ext = path.extname(p).toLowerCase()
              const mimeType = ext === '.mxl' ? 'application/octet-stream' : 'application/xml'
              res.setHeader('Content-Type', mimeType)
              res.end(content)
              return
            }
          }
        }
        
        next()
      })
    }
  }
}
