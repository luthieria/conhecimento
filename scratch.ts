import { generateMarkdown, generateHTML } from '@tiptap/html';
import { Markdown } from 'tiptap-markdown';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Editor } from '@tiptap/core';

// We just want to see how an editor instance serializes the markdown.
const editor = new Editor({
  extensions: [
    StarterKit,
    Table,
    TableRow,
    TableCell.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          backgroundColor: {
            default: null,
            parseHTML: element => element.getAttribute('data-background-color'),
            renderHTML: attributes => {
              if (!attributes.backgroundColor) return {};
              return {
                'data-background-color': attributes.backgroundColor,
                style: `background-color: ${attributes.backgroundColor}`
              };
            }
          }
        };
      }
    }),
    TableHeader,
    Markdown.configure({
      html: true
    })
  ],
  content: `
    <table>
      <tr>
        <th colspan="2" data-background-color="#ff0000">Heading</th>
      </tr>
      <tr>
        <td>A1</td>
        <td>B1</td>
      </tr>
    </table>
  `
});

// @ts-ignore
console.log("MARKDOWN OUTPUT:");
// @ts-ignore
console.log(editor.storage.markdown.getMarkdown());

console.log("HTML OUTPUT:");
console.log(editor.getHTML());
