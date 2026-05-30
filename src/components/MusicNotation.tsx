/**
 * MusicNotation.tsx
 * 
 * A React component that renders LilyPond (.ly) or MusicXML (.musicxml/.xml)
 * notation as beautiful SVG using the Verovio WASM engine.
 * 
 * Supports two input modes:
 * 1. Inline LilyPond code blocks in markdown (```lilypond ... ```)
 * 2. File references to .ly or .musicxml files
 * 
 * The component also supports multi-page scores with page navigation.
 */

import { useEffect, useState, useRef, useCallback } from 'react'

// Verovio toolkit singleton — we only want to initialize once
let verovioToolkitPromise: Promise<any> | null = null

async function getVerovioToolkit() {
  if (!verovioToolkitPromise) {
    verovioToolkitPromise = (async () => {
      const { VerovioToolkit } = await import('verovio/esm')
      const createModule = (await import('verovio/wasm')).default
      const module = await createModule()
      const toolkit = new VerovioToolkit(module)
      return toolkit
    })()
  }
  return verovioToolkitPromise
}

interface MusicNotationProps {
  /** Raw LilyPond or MusicXML source code to render */
  data?: string
  /** URL/path to a .ly or .musicxml file */
  src?: string
  /** Format hint: 'lilypond', 'musicxml', 'mei', 'humdrum', or 'abc' */
  format?: 'lilypond' | 'musicxml' | 'mei' | 'humdrum' | 'abc'
  /** Scale factor (default: 40) */
  scale?: number
  /** Whether to show page navigation for multi-page scores */
  showPagination?: boolean
  /** Optional title/caption for the score */
  caption?: string
}

export default function MusicNotation({
  data,
  src,
  format,
  scale = 40,
  showPagination = true,
  caption,
}: MusicNotationProps) {
  const [svgPages, setSvgPages] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const renderNotation = useCallback(async (sourceData: string) => {
    try {
      setIsLoading(true)
      setError(null)

      const toolkit = await getVerovioToolkit()

      // Calculate responsive width based on container
      const containerWidth = containerRef.current?.clientWidth || 900

      // Set rendering options
      toolkit.setOptions({
        scale,
        pageWidth: Math.floor(containerWidth * (100 / scale)),
        pageMarginLeft: 20,
        pageMarginRight: 20,
        pageMarginTop: 20,
        pageMarginBottom: 20,
        adjustPageHeight: true,
        adjustPageWidth: false,
        breaks: 'auto',
        font: 'Bravura',
        // For LilyPond input
        ...(format === 'lilypond' ? { inputFrom: 'lilypond' } : {}),
        ...(format === 'humdrum' ? { inputFrom: 'humdrum' } : {}),
        ...(format === 'abc' ? { inputFrom: 'abc' } : {}),
      })

      // Load the data
      const success = toolkit.loadData(sourceData)
      if (!success) {
        throw new Error('Failed to parse music notation data. Check the syntax.')
      }

      const pages = toolkit.getPageCount()
      setTotalPages(pages)

      // Render all pages
      const renderedPages: string[] = []
      for (let i = 1; i <= pages; i++) {
        renderedPages.push(toolkit.renderToSVG(i))
      }
      setSvgPages(renderedPages)
      setCurrentPage(1)
    } catch (err: any) {
      console.error('Music notation rendering error:', err)
      setError(err.message || 'Failed to render music notation')
    } finally {
      setIsLoading(false)
    }
  }, [scale, format])

  // Load data from source or props
  useEffect(() => {
    if (data) {
      renderNotation(data)
    } else if (src) {
      fetch(src)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to load ${src}: ${res.status}`)
          return res.text()
        })
        .then(text => renderNotation(text))
        .catch(err => {
          setError(err.message)
          setIsLoading(false)
        })
    }
  }, [data, src, renderNotation])

  // Re-render on window resize
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        if (data) renderNotation(data)
      }, 300)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(timeout)
    }
  }, [data, renderNotation])

  if (error) {
    return (
      <div className="music-notation-error">
        <div className="music-notation-error-icon">
          <span className="material-symbols-outlined">music_off</span>
        </div>
        <div className="music-notation-error-text">
          <strong>Notation Error</strong>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="music-notation-container" ref={containerRef}>
      {isLoading && (
        <div className="music-notation-loading">
          <div className="music-notation-loading-spinner" />
          <span>Engraving score…</span>
        </div>
      )}

      {!isLoading && svgPages.length > 0 && (
        <>
          <div
            className="music-notation-score"
            dangerouslySetInnerHTML={{ __html: svgPages[currentPage - 1] || '' }}
          />

          {showPagination && totalPages > 1 && (
            <div className="music-notation-pagination">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="music-notation-page-btn"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="music-notation-page-info">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="music-notation-page-btn"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          )}

          {caption && (
            <div className="music-notation-caption">{caption}</div>
          )}
        </>
      )}
    </div>
  )
}
