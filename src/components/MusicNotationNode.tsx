import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import MusicNotation from './MusicNotation'
import { useState } from 'react'

const MusicNotationComponent = (props: any) => {
  const { node, updateAttributes } = props
  const { format, source, src } = node.attrs
  const [isEditing, setIsEditing] = useState(false)

  return (
    <NodeViewWrapper className="music-notation-wrapper group relative my-4">
      <div 
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1f1f22] p-1 rounded border border-[#303033] flex gap-2"
      >
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs text-[#d9ca9a] hover:text-white px-2 py-1"
        >
          {isEditing ? 'Preview' : 'Edit Source'}
        </button>
      </div>

      {isEditing ? (
        <textarea
          className="w-full min-h-[200px] p-4 font-mono text-sm bg-[#18181b] text-[#e7e5e8] border border-[#303033] rounded focus:outline-none focus:border-[#d9ca9a]"
          value={source}
          onChange={(e) => updateAttributes({ source: e.target.value })}
          placeholder={`Enter ${format} notation here...`}
        />
      ) : (
        <MusicNotation 
          data={source} 
          src={src}
          format={format as any} 
          caption={`Music Notation (${format})`}
        />
      )}
    </NodeViewWrapper>
  )
}

export const MusicNotationNode = Node.create({
  name: 'musicNotation',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      format: {
        default: 'lilypond',
      },
      source: {
        default: '',
      },
      src: {
        default: null,
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="musicNotation"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'musicNotation' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MusicNotationComponent)
  },
})
