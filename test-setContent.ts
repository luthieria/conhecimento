import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Markdown } from 'tiptap-markdown';

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: element => element.style.backgroundColor || element.getAttribute('data-background-color'),
        renderHTML: attributes => {
          if (!attributes.backgroundColor) {
            return {};
          }
          return {
            'data-background-color': attributes.backgroundColor,
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
    };
  },
});

const editor = new Editor({
  extensions: [
    StarterKit,
    Table,
    TableRow,
    CustomTableCell,
    TableHeader,
    Markdown.configure({ html: true })
  ],
});

editor.commands.setContent(`
# Title
<table>
  <tr>
    <td style="background-color: red" colspan="2">Cell 1</td>
  </tr>
</table>
`);

console.log(editor.getHTML());
