import { useEditor, EditorContent } from '@tiptap/react'
// @ts-ignore
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import TurndownService from 'turndown'
// @ts-ignore
import { gfm } from 'turndown-plugin-gfm'
import { useEffect, useState, useCallback } from 'react'
import TextAlign from '@tiptap/extension-text-align'
import Image from '@tiptap/extension-image'
import { Extension } from '@tiptap/core'
import GraphView from './components/GraphView'
import EthnoGlobe from './components/EthnoGlobe'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { MathExtension } from '@aarkue/tiptap-math-extension'
import 'katex/dist/katex.min.css'
import { MusicNotationNode } from './components/MusicNotationNode'
const buildFootnoteDecorations = (doc: any) => {
  const decorations: Decoration[] = []
  let firstFootnotePos = -1

  const footnoteCounter = new Map<string, number>()
  let currentCount = 1

  // First pass: Find all inline references and assign numbers
  doc.descendants((node: any, pos: number) => {
    if (node.isText && node.text) {
      const refRegex = /\[\^([^\]]+)\](?!:)/g
      let match
      while ((match = refRegex.exec(node.text)) !== null) {
        const id = match[1]
        if (!footnoteCounter.has(id)) {
          footnoteCounter.set(id, currentCount++)
        }
        decorations.push(
          Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
            class: 'footnote-ref-hidden',
            'data-footnote': String(footnoteCounter.get(id))
          })
        )
      }
    }
  })

  // Second pass: Find footnote definitions
  doc.descendants((node: any, pos: number) => {
    if (node.isText && node.text) {
      const defRegex = /\[\^([^\]]+)\]:/g
      let match
      while ((match = defRegex.exec(node.text)) !== null) {
        if (firstFootnotePos === -1) {
          // Approximate block start for the widget
          firstFootnotePos = pos - 1
        }

        const id = match[1]
        let num = footnoteCounter.get(id)
        if (!num) {
          num = currentCount++
          footnoteCounter.set(id, num)
        }

        decorations.push(
          Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
            class: 'footnote-def-identifier-hidden',
            'data-footnote': String(num)
          })
        )
      }
    }

    // Add block styling if the block contains a footnote definition at the start
    if (node.isBlock && node.textContent.match(/^\[\^([^\]]+)\]:/)) {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: 'footnote-def-block'
        })
      )
    }
  })

  if (firstFootnotePos !== -1) {
    const widget = document.createElement('div')
    widget.className = 'footnotes-separator'
    widget.innerHTML = 'Footnotes'
    decorations.push(
      Decoration.widget(firstFootnotePos, widget, { side: -1 })
    )
  }

  return DecorationSet.create(doc, decorations)
}

const buildSyntaxDecorations = (doc: any) => {
  const decorations: Decoration[] = []
  doc.descendants((node: any, pos: number) => {
    if (node.isText && node.text) {
      // Shortcodes ⦃...⦄
      const scRegex = /⦃|⦄/g
      let match
      while ((match = scRegex.exec(node.text)) !== null) {
        decorations.push(
          Decoration.inline(pos + match.index, pos + match.index + 1, {
            class: 'shortcode-symbol'
          })
        )
      }

      // Wikilinks ⟦...⟧
      const wlRegex = /⟦|⟧/g
      while ((match = wlRegex.exec(node.text)) !== null) {
        decorations.push(
          Decoration.inline(pos + match.index, pos + match.index + 1, {
            class: 'wikilink-symbol'
          })
        )
      }
    }
  })
  return DecorationSet.create(doc, decorations)
}

const SyntaxDecorator = Extension.create({
  name: 'syntaxDecorator',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('syntaxDecorator'),
        state: {
          init(_config, instance) {
            return buildSyntaxDecorations(instance.doc)
          },
          apply(tr, oldState) {
            if (!tr.docChanged) return oldState.map(tr.mapping, tr.doc)
            return buildSyntaxDecorations(tr.doc)
          }
        },
        props: {
          decorations(state) {
            return this.getState(state)
          }
        }
      })
    ]
  }
})

const FootnoteDecorator = Extension.create({
  name: 'footnoteDecorator',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('footnoteDecorator'),
        state: {
          init(_config, instance) {
            return buildFootnoteDecorations(instance.doc)
          },
          apply(tr, oldState) {
            if (!tr.docChanged) return oldState.map(tr.mapping, tr.doc)
            return buildFootnoteDecorations(tr.doc)
          }
        },
        props: {
          decorations(state) {
            return this.getState(state)
          }
        }
      })
    ]
  }
})

const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: element => element.getAttribute('data-background-color') || element.style.backgroundColor,
        renderHTML: attributes => {
          if (!attributes.backgroundColor) {
            return {}
          }
          return {
            'data-background-color': attributes.backgroundColor,
            style: `background-color: ${attributes.backgroundColor};`,
          }
        },
      },
      verticalAlign: {
        default: 'middle',
        parseHTML: element => element.style.verticalAlign || 'middle',
        renderHTML: attributes => {
          if (!attributes.verticalAlign || attributes.verticalAlign === 'middle') {
            return {}
          }
          return {
            style: `vertical-align: ${attributes.verticalAlign};`,
          }
        },
      },
      textAlign: {
        default: 'center',
        parseHTML: element => element.style.textAlign || 'center',
        renderHTML: attributes => {
          if (!attributes.textAlign || attributes.textAlign === 'center') {
            return {}
          }
          return {
            style: `text-align: ${attributes.textAlign};`,
          }
        },
      },
    }
  },
})

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: element => element.getAttribute('data-background-color') || element.style.backgroundColor,
        renderHTML: attributes => {
          if (!attributes.backgroundColor) {
            return {}
          }
          return {
            'data-background-color': attributes.backgroundColor,
            style: `background-color: ${attributes.backgroundColor};`,
          }
        },
      },
      verticalAlign: {
        default: 'middle',
        parseHTML: element => element.style.verticalAlign || 'middle',
        renderHTML: attributes => {
          if (!attributes.verticalAlign || attributes.verticalAlign === 'middle') {
            return {}
          }
          return {
            style: `vertical-align: ${attributes.verticalAlign};`,
          }
        },
      },
      textAlign: {
        default: 'center',
        parseHTML: element => element.style.textAlign || 'center',
        renderHTML: attributes => {
          if (!attributes.textAlign || attributes.textAlign === 'center') {
            return {}
          }
          return {
            style: `text-align: ${attributes.textAlign};`,
          }
        },
      },
    }
  },
})


const TableTopMenu = ({ editor }: { editor: any }) => {
  const [pos, setPos] = useState<{ top: number, left: number, width: number } | null>(null)

  useEffect(() => {
    if (!editor) return
    const update = () => {
      if (editor.isActive('table')) {
        const { view, state } = editor
        const { selection } = state
        let node = view.domAtPos(selection.from).node as HTMLElement
        while (node && node.nodeName !== 'TABLE' && node.nodeName !== 'BODY') {
          node = node.parentNode as HTMLElement
        }
        if (node && node.nodeName === 'TABLE') {
          const rect = node.getBoundingClientRect()
          setPos({ top: rect.top, left: rect.left, width: rect.width })
          return
        }
      }
      setPos(null)
    }
    editor.on('selectionUpdate', update)
    editor.on('update', update)
    const interval = setInterval(update, 100)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('update', update)
      clearInterval(interval)
    }
  }, [editor])

  if (!pos) return null

  return (
    <div
      className="fixed z-[60] flex bg-[#1f1f22] backdrop-blur-xl border border-[#303033] rounded-md p-1.5 gap-1.5 text-[#e7e5e8] shadow-lg text-xs font-ui items-center"
      style={{ top: pos.top - 45, left: pos.left + pos.width / 2, transform: 'translateX(-50%)' }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`px-1.5 py-1 rounded transition-colors block leading-tight ${editor.isActive({ textAlign: 'left' }) ? 'bg-[#d9ca9a] text-[#0e0e0f]' : 'hover:bg-[#303033]'}`} title="Align Left"><span className="material-symbols-outlined text-[16px]">format_align_left</span></button>
      <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`px-1.5 py-1 rounded transition-colors block leading-tight ${editor.isActive({ textAlign: 'center' }) ? 'bg-[#d9ca9a] text-[#0e0e0f]' : 'hover:bg-[#303033]'}`} title="Align Center"><span className="material-symbols-outlined text-[16px]">format_align_center</span></button>
      <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`px-1.5 py-1 rounded transition-colors block leading-tight ${editor.isActive({ textAlign: 'right' }) ? 'bg-[#d9ca9a] text-[#0e0e0f]' : 'hover:bg-[#303033]'}`} title="Align Right"><span className="material-symbols-outlined text-[16px]">format_align_right</span></button>
      <div className="w-[2px] h-4 bg-[#303033] mx-0.5 rounded"></div>
      <button onClick={() => editor.chain().focus().setCellAttribute('verticalAlign', 'top').run()} className="px-1.5 py-1 hover:bg-[#303033] rounded transition-colors block leading-tight" title="Align Top"><span className="material-symbols-outlined text-[16px]">vertical_align_top</span></button>
      <button onClick={() => editor.chain().focus().setCellAttribute('verticalAlign', 'middle').run()} className="px-1.5 py-1 hover:bg-[#303033] rounded transition-colors block leading-tight" title="Align Middle"><span className="material-symbols-outlined text-[16px]">vertical_align_center</span></button>
      <button onClick={() => editor.chain().focus().setCellAttribute('verticalAlign', 'bottom').run()} className="px-1.5 py-1 hover:bg-[#303033] rounded transition-colors block leading-tight" title="Align Bottom"><span className="material-symbols-outlined text-[16px]">vertical_align_bottom</span></button>
      <div className="w-[2px] h-4 bg-[#303033] mx-0.5 rounded"></div>
      <button onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', '#cfe2f3').run()} className="w-5 h-5 bg-[#cfe2f3] rounded-full border border-black/20 hover:scale-110 transition-transform" title="Set Blue Background"></button>
      <button onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', '#f4cccc').run()} className="w-5 h-5 bg-[#f4cccc] rounded-full border border-black/20 hover:scale-110 transition-transform" title="Set Red Background"></button>
      <button onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', '#d9ead3').run()} className="w-5 h-5 bg-[#d9ead3] rounded-full border border-black/20 hover:scale-110 transition-transform" title="Set Green Background"></button>
      <button onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', '#fff2cc').run()} className="w-5 h-5 bg-[#fff2cc] rounded-full border border-black/20 hover:scale-110 transition-transform" title="Set Yellow Background"></button>
      <button onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', '#fce5cd').run()} className="w-5 h-5 bg-[#fce5cd] rounded-full border border-black/20 hover:scale-110 transition-transform" title="Set Orange Background"></button>
      <button onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', '#ead1dc').run()} className="w-5 h-5 bg-[#ead1dc] rounded-full border border-black/20 hover:scale-110 transition-transform" title="Set Purple Background"></button>
      <button onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', '#d0e0e3').run()} className="w-5 h-5 bg-[#d0e0e3] rounded-full border border-black/20 hover:scale-110 transition-transform" title="Set Cyan Background"></button>
      <button onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', '#d9d9d9').run()} className="w-5 h-5 bg-[#d9d9d9] rounded-full border border-black/20 hover:scale-110 transition-transform" title="Set Gray Background"></button>
      <button onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', null).run()} className="px-1.5 py-1 hover:bg-[#303033] rounded transition-colors block leading-tight opacity-70" title="Clear Color"><span className="material-symbols-outlined text-[16px]">format_color_reset</span></button>
    </div>
  )
}

export default function App() {
  const [fileTree, setFileTree] = useState<any[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, show: boolean } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [frontmatter, setFrontmatter] = useState<string>('')
  const [isSidebarPinned, setIsSidebarPinned] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'reading' | 'editing'>('reading')
  const [rawMarkdown, setRawMarkdown] = useState<string>('')

  const parseFrontmatter = (fm: string) => {
    const result: any = {}
    if (!fm) return result
    const lines = fm.split('\n')
    lines.forEach(line => {
      const trimmed = line.trim()
      if (trimmed === '---') return
      const match = trimmed.match(/^([^:]+):\s*(.*)$/)
      if (match) {
        const key = match[1].trim()
        let value = match[2].trim()
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
        result[key] = value
      }
    })
    return result
  }

  const fm = parseFrontmatter(frontmatter)
  const isGlobe = !!activeFile && (activeFile.includes('Etnomusicolog') || rawMarkdown.includes('ethno-world-map') || fm.bodyClass === 'page-ethno-map-full' || fm.layout === 'globe')

  useEffect(() => {
    if (isGlobe) {
      document.body.classList.add('page-ethno-map-full-active')
      return () => {
        document.body.classList.remove('page-ethno-map-full-active')
      }
    } else {
      document.body.classList.remove('page-ethno-map-full-active')
    }
  }, [isGlobe])

  const findNodeByIndexPath = (nodes: any[], indexPath: string): any | null => {
    if (!indexPath) return null
    // Normalize path for comparison
    const normalizedTarget = indexPath.replace(/\\/g, '/').toLowerCase()
    for (const node of nodes) {
      const normalizedPath = node.path?.replace(/\\/g, '/').toLowerCase()
      const normalizedIndexPath = node.indexPath?.replace(/\\/g, '/').toLowerCase()
      if (normalizedPath === normalizedTarget || normalizedIndexPath === normalizedTarget) return node
      if (node.children) {
        const found = findNodeByIndexPath(node.children, indexPath)
        if (found) return found
      }
    }
    return null
  }

  const TabbedLinks = ({ nodes }: { nodes: any[] }) => {
    if (!nodes || nodes.length === 0) return null
    return (
      <div className="tab-links-grid">
        <div className="tab-links-row" style={{ '--tab-count': nodes.length } as any}>
          {nodes.map((node, i) => (
            <div
              key={i}
              onClick={() => {
                if (node.type === 'directory' && node.indexPath) {
                  loadFile(node.indexPath)
                } else if (node.type === 'file' || node.type === 'folder-link') {
                  loadFile(node.path)
                }
              }}
              className="tab-link"
            >
              {node.icon && (
                <span className="material-symbols-outlined">
                  {node.icon}
                </span>
              )}
              <span className="tab-link-title">{node.name}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Track headings for TOC
  const [headings, setHeadings] = useState<{ level: number, text: string, id: string }[]>([])

  const extractHeadings = (editorInstance: any) => {
    const json = editorInstance.getJSON()
    if (!json.content) return

    const extracted: { level: number, text: string, id: string }[] = []
    json.content.forEach((node: any, index: number) => {
      if (node.type === 'heading' && node.content) {
        const text = node.content.map((n: any) => n.text).join('')
        const id = `heading-${index}`
        extracted.push({ level: node.attrs.level, text, id })
      }
    })
    setHeadings(extracted)
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      Table.configure({ resizable: true }),
      TableRow,
      CustomTableHeader,
      CustomTableCell,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      MathExtension.configure({ evaluation: false }),
      FootnoteDecorator,
      SyntaxDecorator,
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg shadow-sm',
        },
      }),
      MusicNotationNode,
    ],
    editable: false,
    content: "# The Digital Archivist\n\nSelect a manuscript from your local library on the left to begin editing. Changes will be saved directly to your Amethyst `.md` files.",
    editorProps: {
      attributes: {
        class: 'prose-none max-w-none focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      extractHeadings(editor)
    }
  })

  const loadFile = useCallback((path: string, updateUrl: boolean = true) => {
    setActiveFile(path)
    if (updateUrl) {
      window.history.pushState(null, '', `#${path}`)
    }

    setIsLoading(true)
    fetch(`/api/file?path=${encodeURIComponent(path)}`)
      .then(res => res.text())
      .then(text => {
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;
        const match = text.match(frontmatterRegex);

        let fm = '';
        let contentBody = text;
        setRawMarkdown(text);

        if (match) {
          fm = match[0];
          contentBody = text.substring(match[0].length);
        }

        setFrontmatter(fm);

        const protectedBody = contentBody
          .replace(/{{[<%]/g, '⦃')
          .replace(/[>%]}}/g, '⦄')
          .replace(/\[\[/g, '⟦')
          .replace(/\]\]/g, '⟧')
          .replace(/\!⟦(.*?)⟧/g, (_, target) => {
            // Handle image wikilinks !⟦image.png⟧
            let imagePath = target.split('|')[0].trim();
            if (!imagePath.startsWith('/') && !imagePath.startsWith('http')) {
              const folder = path.includes('/') ? path.split('/').slice(0, -1).join('/') : '';
              imagePath = folder ? `${folder}/${imagePath}` : imagePath;
            }
            return `<img src="/${imagePath}" alt="${target}" data-wikilink="true" />`;
          })
          .replace(/\!\[(.*?)\]\((.*?)\)(\{.*?\})?/g, (_, alt, src) => {
            // Handle standard markdown images ![alt](src){attr}
            let imagePath = src.trim();

            // Remove < > if present (Goldmark style)
            if (imagePath.startsWith('<') && imagePath.endsWith('>')) {
              imagePath = imagePath.slice(1, -1);
            }

            // Handle Obsidian/Hugo attributes in alt text (e.g. ![alt|500](src))
            // We'll strip them for now to ensure path resolution works
            const cleanAlt = alt.split('|')[0].trim();

            if (!imagePath.startsWith('/') && !imagePath.startsWith('http')) {
              const folder = path.includes('/') ? path.split('/').slice(0, -1).join('/') : '';
              imagePath = folder ? `${folder}/${imagePath}` : imagePath;
            }

            // Ensure path starts with / for our middleware
            const finalPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;

            // Return as standard markdown image but with resolved absolute path
            // Tiptap's Markdown extension will handle this correctly
            return `![${cleanAlt}](${finalPath})`;
          })
          .replace(/```(lilypond|musicxml|abc|mei|humdrum)\n([\s\S]*?)```/g, (_, format, content) => {
            return `<div data-type="musicNotation" data-format="${format}" data-source="${content.trim().replace(/"/g, '&quot;')}"></div>`;
          })
          .replace(/⦃<\s*music\s+src="([^"]+)"\s*(?:format="([^"]+)")?\s*>⦄/g, (_, src, format) => {
            return `<div data-type="musicNotation" data-format="${format || 'lilypond'}" data-src="${src.replace(/"/g, '&quot;')}"></div>`;
          })
          .replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) => `<span data-type="inlineMath" data-latex="${latex.trim().replace(/"/g, '&quot;')}" data-display="yes"></span>`)
          .replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (_, latex) => `<span data-type="inlineMath" data-latex="${latex.trim().replace(/"/g, '&quot;')}" data-display="no"></span>`);

        if (editor) {
          editor.commands.setContent(protectedBody)
          setTimeout(() => extractHeadings(editor), 100)
        }
      })
      .finally(() => setIsLoading(false))
  }, [editor])

  useEffect(() => {
    fetch('/api/files')
      .then(res => res.json())
      .then(data => {
        setFileTree(data)

        // Find top-level directories to expand by default
        const topLevelDirs = data
          .filter((node: any) => node.type === 'directory')
          .map((node: any) => node.path)

        const hash = window.location.hash.slice(1)
        if (hash) {
          const decodedPath = decodeURIComponent(hash)
          loadFile(decodedPath, false)

          // Expand parent folders automatically
          const parts = decodedPath.split('/')
          let currentPath = ''
          const toExpand = new Set<string>(topLevelDirs)
          for (let i = 0; i < parts.length - 1; i++) {
            currentPath += (currentPath ? '/' : '') + parts[i]
            toExpand.add(currentPath)
          }
          setExpandedFolders(prev => new Set([...prev, ...toExpand]))
        } else {
          setExpandedFolders(prev => new Set([...prev, ...topLevelDirs]))
        }
      })
      .catch(console.error)
  }, [loadFile])

  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.slice(1)
      if (hash) {
        loadFile(decodeURIComponent(hash), false)
      } else {
        setActiveFile(null)
        if (editor) editor.commands.setContent('')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [loadFile, editor])

  const getEditorMarkdown = useCallback(() => {
    if (!editor) return ''
    const html = editor.getHTML()
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
    })
    turndownService.use(gfm)
    turndownService.keep(['table', 'tr', 'td', 'th', 'tbody', 'thead', 'colgroup', 'col'])

    turndownService.addRule('inlineMath', {
      filter: (node: any) => {
        return node.nodeName === 'SPAN' && node.getAttribute('data-type') === 'inlineMath';
      },
      replacement: (_: string, node: any) => {
        const isDisplay = node.getAttribute('data-display') === 'yes';
        const latex = node.getAttribute('data-latex');
        return isDisplay ? `\n$$\n${latex}\n$$\n` : `$${latex}$`;
      }
    });

    turndownService.addRule('image', {
      filter: 'img',
      replacement: (_: string, node: any) => {
        const alt = node.getAttribute('alt') || '';
        const src = node.getAttribute('src') || '';
        const isWiki = node.getAttribute('data-wikilink') === 'true';

        if (isWiki) {
          return `![[${alt}]]`;
        }
        return `![${alt}](${src})`;
      }
    });

    turndownService.addRule('musicNotation', {
      filter: (node: any) => node.nodeName === 'DIV' && node.getAttribute('data-type') === 'musicNotation',
      replacement: (_: string, node: any) => {
        const format = node.getAttribute('data-format') || 'lilypond';
        const source = node.getAttribute('data-source');
        const src = node.getAttribute('data-src');
        if (src) {
          return `\n{{< music src="${src}" format="${format}" >}}\n`;
        }
        return `\n\`\`\`${format}\n${source || ''}\n\`\`\`\n`;
      }
    });

    let markdownOutput = turndownService.turndown(html)

    // Restore the protected syntaxes
    markdownOutput = markdownOutput
      .replace(/⦃/g, '{{<')
      .replace(/⦄/g, '>}}')
      .replace(/⟦/g, '[[')
      .replace(/⟧/g, ']]');

    return frontmatter + markdownOutput
  }, [editor, frontmatter])

  const toggleViewMode = () => {
    if (viewMode === 'reading') {
      // Switching to editing: capture current Markdown from editor
      setRawMarkdown(getEditorMarkdown())
      setViewMode('editing')
    } else {
      // Switching to reading: parse rawMarkdown into editor
      const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;
      const match = rawMarkdown.match(frontmatterRegex);

      let fm = '';
      let contentBody = rawMarkdown;

      if (match) {
        fm = match[0];
        contentBody = rawMarkdown.substring(match[0].length);
      }

      setFrontmatter(fm);

      const protectedBody = contentBody
        .replace(/{{[<%]/g, '⦃')
        .replace(/[>%]}}/g, '⦄')
        .replace(/\[\[/g, '⟦')
        .replace(/\]\]/g, '⟧')
        .replace(/```(lilypond|musicxml|abc|mei|humdrum)\n([\s\S]*?)```/g, (_, format, content) => {
          return `<div data-type="musicNotation" data-format="${format}" data-source="${content.trim().replace(/"/g, '&quot;')}"></div>`;
        })
        .replace(/⦃<\s*music\s+src="([^"]+)"\s*(?:format="([^"]+)")?\s*>⦄/g, (_, src, format) => {
          return `<div data-type="musicNotation" data-format="${format || 'lilypond'}" data-src="${src.replace(/"/g, '&quot;')}"></div>`;
        })
        .replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) => `<span data-type="inlineMath" data-latex="${latex.trim().replace(/"/g, '&quot;')}" data-display="yes"></span>`)
        .replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (_, latex) => `<span data-type="inlineMath" data-latex="${latex.trim().replace(/"/g, '&quot;')}" data-display="no"></span>`);

      if (editor) {
        editor.commands.setContent(protectedBody)
        setTimeout(() => extractHeadings(editor), 100)
      }
      setViewMode('reading')
    }
  }

  const saveFile = useCallback(() => {
    if (!activeFile) return
    setIsSaving(true)

    const finalContent = viewMode === 'reading' ? getEditorMarkdown() : rawMarkdown

    fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: activeFile,
        content: finalContent
      })
    })
      .then(res => res.json())
      .then(() => {
        setTimeout(() => setIsSaving(false), 2000)
      })
      .catch(console.error)
  }, [activeFile, viewMode, getEditorMarkdown, rawMarkdown])

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderPath)) {
        next.delete(folderPath)
      } else {
        next.add(folderPath)
      }
      return next
    })
  }

  const createNewFile = () => {
    const filename = prompt("Enter new manuscript name (e.g., 'Chapter 1'):");
    if (!filename) return;

    // Decide directory based on activeFile or default to root
    let dir = '';
    if (activeFile) {
      const parts = activeFile.split('/');
      parts.pop(); // remove filename
      dir = parts.join('/');
    }

    fetch('/api/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory: dir, filename })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // refresh tree
          fetch('/api/files')
            .then(res => res.json())
            .then(treeData => {
              setFileTree(treeData);
              loadFile(data.path);
            })
        } else {
          alert('Failed to create file: ' + data.error);
        }
      })
      .catch(console.error)
  }

  const getFileCount = (node: any): number => {
    if (node.type === 'file') return 1;
    if (!node.children) return 0;
    return node.children.reduce((acc: number, child: any) => acc + getFileCount(child), 0);
  }

  const renderTree = (nodes: any[], level = 0) => {
    return nodes.map((node, i) => {
      const count = getFileCount(node);

      if (node.type === 'directory') {
        const isExpanded = expandedFolders.has(node.path)
        return (
          <div key={node.path || (node.name + i)}>
            <div
              className="py-1.5 text-[#e7e5e8]/90 hover:text-[#e7e5e8] transition-colors rounded-md pr-6"
              style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto', alignItems: 'center' }}
            >
              <span
                className="material-symbols-outlined !text-[32px] transition-transform duration-200 cursor-pointer p-0.5 rounded justify-self-start"
                style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFolder(node.path)
                }}
              >
                chevron_right
              </span>
              <div
                className="flex items-center cursor-pointer overflow-hidden"
                onClick={() => {
                  if (node.indexPath) {
                    loadFile(node.indexPath)
                  } else {
                    toggleFolder(node.path)
                  }
                }}
              >
                {node.icon && (
                  <span className="material-symbols-outlined mr-2 !text-[24px] text-[#e7e5e8]/50 shrink-0">
                    {node.icon}
                  </span>
                )}
                <span className="text-[18px] font-bold truncate">{node.name}</span>
              </div>
              <span className="text-[15px] opacity-40 ml-2 shrink-0 font-mono">{count}</span>
            </div>
            <div 
              className="grid transition-[grid-template-rows] duration-200 ease-in-out"
              style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <div className="ml-[18px] pl-[4px] border-l border-[#ffffff]/10">
                  {node.children && renderTree(node.children, level + 1)}
                </div>
              </div>
            </div>
          </div>
        )
      } else if (node.type === 'folder-link') {
        const isActive = activeFile === node.path
        return (
          <div key={node.path || (node.name + i)}>
            <div
              onClick={() => {
                toggleFolder(node.path.split('/').slice(0, -1).join('/'))
                loadFile(node.path)
              }}
              className={`py-1.5 cursor-pointer transition-colors rounded-md pr-6 ${isActive ? 'text-[#d9ca9a]' : 'text-[#e7e5e8]/90 hover:text-[#e7e5e8]'}`}
              style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto', alignItems: 'center' }}
            >
              <span />
              <div className="flex items-center overflow-hidden">
                {node.icon && (
                  <span className="material-symbols-outlined mr-2 !text-[24px] shrink-0 text-[#e7e5e8]/50">
                    {node.icon}
                  </span>
                )}
                <span className="text-[18px] font-bold truncate">{node.name}</span>
              </div>
              <span className="text-[15px] opacity-40 ml-2 shrink-0 font-mono">{count}</span>
            </div>
          </div>
        )
      } else {
        const isActive = activeFile === node.path
        return (
          <div
            key={node.path}
            onClick={() => loadFile(node.path)}
            className={`py-1.5 cursor-pointer transition-all rounded-md pr-6 ${isActive ? 'text-[#d9ca9a]' : 'text-[#e7e5e8]/80 hover:text-[#e7e5e8]'}`}
            style={{ display: 'grid', gridTemplateColumns: '36px 1fr', alignItems: 'center' }}
          >
            <span />
            <div className="flex items-center overflow-hidden">
              {node.icon && (
                <span className="material-symbols-outlined mr-2 !text-[24px] shrink-0 text-[#e7e5e8]/50">
                  {node.icon}
                </span>
              )}
              <span className="text-[18px] font-bold truncate">{node.name}</span>
            </div>
          </div>
        )
      }
    })
  }

  return (
    <>
      <div
        className="sidebar-hover-zone"
        onMouseEnter={() => setIsSidebarOpen(true)}
      />



      <aside
        className={`bg-[#131315] font-ui fixed left-0 h-screen w-[16rem] flex flex-col z-40 border-r border-[#1f1f22] sidebar-autohide ${isSidebarOpen ? 'is-open' : ''} ${isSidebarPinned ? 'is-pinned' : ''}`}
        onMouseEnter={() => setIsSidebarOpen(true)}
        onMouseLeave={() => setIsSidebarOpen(false)}
      >
        <button
          className="sidebar-pin-button"
          onClick={() => setIsSidebarPinned(!isSidebarPinned)}
        >
          <span className="pin-line"></span>
        </button>

        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          <div className="pl-3.5 pr-6 pt-2 pb-2 flex flex-col gap-1 shrink-0">
            <a href="/" className="text-[#e7e5e8] hover:text-[#a3be8c] transition-colors" title="Home (Graph View)">
              <span className="material-symbols-outlined !text-[32px]">hub</span>
            </a>
          </div>
          <nav className="flex-1 space-y-0.5 pb-20 select-none pl-1">
            {renderTree(fileTree)}
          </nav>
        </div>
      </aside>

      <main className={`min-h-screen pb-32 transition-all duration-[220ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] ${isSidebarPinned ? 'ml-[16rem]' : 'ml-0'}`}>
        <nav className="relative z-10 bg-transparent font-ui uppercase text-[10px] tracking-widest font-bold flex items-center justify-between px-12 pt-2 pb-4 w-full gap-4">
          <div className="flex-1 min-w-0 flex items-center whitespace-nowrap overflow-hidden text-ellipsis mr-4">
            {activeFile ? (() => {
              const parts = activeFile.split('/').filter(p => p !== '_index.md');
              let cumulativePath = '';
              return parts.map((part, index) => {
                // If the original activeFile had _index.md, we still need the cumulative path to find the right nodes,
                // but wait, if cumulativePath is just the folder, findNodeByIndexPath will still find the folder node!
                // Let's just build it normally.
                cumulativePath = cumulativePath ? `${cumulativePath}/${part}` : part;
                const isLast = index === parts.length - 1;

                let node = findNodeByIndexPath(fileTree, cumulativePath);
                if (!node && !part.endsWith('.md')) {
                  node = findNodeByIndexPath(fileTree, `${cumulativePath}/_index.md`);
                }

                let displayName = part.replace('.md', '');
                if (node?.name) {
                  displayName = node.name;
                }

                return (
                  <span key={cumulativePath} className="flex items-center">
                    {index > 0 && <span className="text-[#e7e5e8]/30 mx-3">/</span>}
                    <span
                      className={`cursor-pointer transition-colors ${isLast ? 'text-[#a3be8c] cursor-default' : 'text-[#e7e5e8]/50 hover:text-[#e7e5e8]'}`}
                      onClick={() => {
                        if (isLast) return;
                        if (!part.endsWith('.md')) {
                          if (node && node.indexPath) {
                            loadFile(node.indexPath);
                          } else {
                            loadFile(cumulativePath + '/_index.md');
                          }
                        } else {
                          loadFile(cumulativePath);
                        }
                      }}
                    >
                      {displayName}
                    </span>
                  </span>
                );
              });
            })() : null}
          </div>
          {activeFile && (
            <div className="flex items-center gap-4 shrink-0">
              <button
                onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                className="px-3 py-1.5 rounded-md flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold transition-all bg-[#1f1f22] text-[#e7e5e8]/70 hover:bg-[#1f1f22]/80 hover:text-[#e7e5e8] border border-[#303033]"
              >
                <span className="material-symbols-outlined text-[14px]">table</span>
                Insert Table
              </button>
              <div className="flex items-center gap-1 bg-[#1f1f22] p-1 rounded-md border border-[#303033]">
                <button
                  onClick={() => viewMode !== 'reading' && toggleViewMode()}
                  className={`px-3 py-1.5 rounded transition-colors flex items-center gap-2 ${viewMode === 'reading' ? 'bg-[#303033] text-[#e7e5e8]' : 'text-[#e7e5e8]/50 hover:text-[#e7e5e8]'}`}
                  title="Reading / Visual Mode"
                >
                  <span className="material-symbols-outlined text-[14px]">menu_book</span>
                  Reading
                </button>
                <button
                  onClick={() => viewMode !== 'editing' && toggleViewMode()}
                  className={`px-3 py-1.5 rounded transition-colors flex items-center gap-2 ${viewMode === 'editing' ? 'bg-[#303033] text-[#e7e5e8]' : 'text-[#e7e5e8]/50 hover:text-[#e7e5e8]'}`}
                  title="Source / Editing Mode"
                >
                  <span className="material-symbols-outlined text-[14px]">edit_document</span>
                  Editing
                </button>
              </div>
              <button
                onClick={saveFile}
                disabled={!activeFile}
                className={`px-4 py-2 rounded-md flex items-center gap-2 text-xs font-semibold transition-all border border-[#303033] ${!activeFile ? 'opacity-30 cursor-not-allowed text-[#e7e5e8]' :
                  isSaving ? 'bg-[#a3be8c] text-[#0e0e0f] border-transparent' : 'bg-[#1f1f22] text-[#d9ca9a] hover:bg-[#d9ca9a]/20'
                  }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isSaving ? 'check_circle' : 'save'}
                </span>
                {isSaving ? 'Synchronized' : 'Save Manuscript'}
              </button>
            </div>
          )}
        </nav>

        <article className="max-w-[40rem] mx-auto px-4 mt-8 font-body leading-relaxed pb-40">
          {isLoading ? (
            <div className="text-center mt-32 text-[#e7e5e8]/40 animate-pulse font-ui tracking-widest uppercase text-sm">
              Retrieving Archives...
            </div>
          ) : (
            <>
              {!activeFile && (
                <div className="fixed inset-0 z-0">
                  <GraphView onNodeClick={loadFile} />
                </div>
              )}
              {activeFile && (() => {
                const isTabbed = fm.type === 'tabbed' || fm.layout === 'tabbed'

                return (
                  <>
                    {isGlobe ? (
                      <EthnoGlobe onNavigate={loadFile} />
                    ) : !isTabbed ? (
                      viewMode === 'reading' ? (
                        <div
                          onContextMenu={(e) => {
                            if (editor?.isActive('table')) {
                              e.preventDefault()
                              setContextMenu({ x: e.clientX, y: e.clientY, show: true })
                            }
                          }}
                          onClick={() => setContextMenu(null)}
                        >
                          <EditorContent editor={editor} />
                        </div>
                      ) : (
                        <textarea
                          value={rawMarkdown}
                          onChange={(e) => setRawMarkdown(e.target.value)}
                          className="w-full min-h-[60vh] bg-[#1f1f22] text-[#e7e5e8] p-6 rounded-md font-['Fira_Code',monospace] text-sm leading-relaxed border border-[#303033] focus:outline-none focus:border-[#d9ca9a] resize-y"
                          spellCheck={false}
                        />
                      )
                    ) : null}

                    {isTabbed && !isGlobe && (() => {
                      const node = findNodeByIndexPath(fileTree, activeFile)
                      return <TabbedLinks nodes={node?.children || []} />
                    })()}
                  </>
                )
              })()}

              <TableTopMenu editor={editor} />
              {contextMenu && contextMenu.show && (
                <div
                  className="fixed bg-[#1f1f22] border border-[#303033] rounded-md shadow-xl py-1 z-[70] text-[#e7e5e8] text-[11px] font-ui w-48 flex flex-col"
                  style={{ top: contextMenu.y, left: contextMenu.x }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <button onClick={() => { editor?.chain().focus().addRowBefore().run(); setContextMenu(null); }} className="px-3 py-2 hover:bg-[#303033] flex items-center gap-2.5 text-left"><span className="material-symbols-outlined text-[15px] opacity-70">keyboard_arrow_up</span> Insert row above</button>
                  <button onClick={() => { editor?.chain().focus().addRowAfter().run(); setContextMenu(null); }} className="px-3 py-2 hover:bg-[#303033] flex items-center gap-2.5 text-left"><span className="material-symbols-outlined text-[15px] opacity-70">keyboard_arrow_down</span> Insert row below</button>
                  <button onClick={() => { editor?.chain().focus().deleteRow().run(); setContextMenu(null); }} className="px-3 py-2 hover:bg-red-500/20 text-red-300 flex items-center gap-2.5 text-left"><span className="material-symbols-outlined text-[15px] opacity-70">table_rows</span> Delete row</button>
                  <div className="h-[1px] bg-[#303033] mx-1 my-0.5"></div>
                  <button onClick={() => { editor?.chain().focus().addColumnBefore().run(); setContextMenu(null); }} className="px-3 py-2 hover:bg-[#303033] flex items-center gap-2.5 text-left"><span className="material-symbols-outlined text-[15px] opacity-70">keyboard_arrow_left</span> Insert column left</button>
                  <button onClick={() => { editor?.chain().focus().addColumnAfter().run(); setContextMenu(null); }} className="px-3 py-2 hover:bg-[#303033] flex items-center gap-2.5 text-left"><span className="material-symbols-outlined text-[15px] opacity-70">keyboard_arrow_right</span> Insert column right</button>
                  <button onClick={() => { editor?.chain().focus().deleteColumn().run(); setContextMenu(null); }} className="px-3 py-2 hover:bg-red-500/20 text-red-300 flex items-center gap-2.5 text-left"><span className="material-symbols-outlined text-[15px] opacity-70">view_column</span> Delete column</button>
                  <div className="h-[1px] bg-[#303033] mx-1 my-0.5"></div>
                  <button onClick={() => { editor?.chain().focus().mergeCells().run(); setContextMenu(null); }} className="px-3 py-2 hover:bg-[#303033] flex items-center gap-2.5 text-left"><span className="material-symbols-outlined text-[15px] opacity-70">merge_type</span> Merge cells</button>
                  <button onClick={() => { editor?.chain().focus().splitCell().run(); setContextMenu(null); }} className="px-3 py-2 hover:bg-[#303033] flex items-center gap-2.5 text-left"><span className="material-symbols-outlined text-[15px] opacity-70">splitscreen</span> Split cell</button>
                  <div className="h-[1px] bg-[#303033] mx-1 my-0.5"></div>
                  <button onClick={() => { editor?.chain().focus().deleteTable().run(); setContextMenu(null); }} className="px-3 py-2 hover:bg-red-500/30 text-red-300 flex items-center gap-2.5 text-left"><span className="material-symbols-outlined text-[15px] opacity-70">delete</span> Delete table</button>
                </div>
              )}
            </>
          )}
        </article>
      </main>

      {activeFile && headings.length > 0 && !isGlobe && (
        <nav className="bg-[#1f1f22]/70 backdrop-blur-xl font-ui text-xs italic docked right-4 top-24 w-56 rounded-lg no-border glassmorphism shadow-glow shadow-[0_0_40px_-5px_rgba(231,229,232,0.04)] fixed right-8 top-32 flex flex-col p-4 z-40">
          <div className="mb-6">
            <span className="text-sm font-semibold text-[#ebcb8b]">Table of Contents</span>
            <p className="text-[10px] text-on-surface/40 non-italic mt-1 uppercase tracking-tighter">On this page</p>
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto max-h-[60vh] custom-scrollbar">
            {headings.map((h) => {
              const ml = (h.level - 1) * 0.75
              return (
                <div
                  key={h.id}
                  style={{ marginLeft: `${ml}rem` }}
                  className="text-on-surface/50 hover:text-[#ebcb8b] transition-colors scale-100 hover:scale-105 origin-left transition-transform flex items-start gap-2 cursor-pointer pb-2"
                  onClick={() => {
                    // Quick and dirty scroll by finding the hN tag containing this text.
                    const domElements = Array.from(document.querySelectorAll(`h${h.level}`))
                    const target = domElements.find(el => el.textContent === h.text)
                    if (target) {
                      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  }}
                >
                  <span className="material-symbols-outlined text-[14px] mt-0.5 opacity-40">
                    {h.level === 1 ? 'label_important' : h.level === 2 ? 'subject' : h.level === 3 ? 'analytics' : 'short_text'}
                  </span>
                  <span className={h.level === 1 ? 'font-bold text-[#ebcb8b]' : ''}>
                    {h.text}
                  </span>
                </div>
              )
            })}
          </div>
        </nav>
      )}
    </>
  )
}
