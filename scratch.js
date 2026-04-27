import { generateMarkdown } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Markdown } from 'tiptap-markdown';

const json = {
  type: 'doc',
  content: [
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: { colspan: 2, rowspan: 1 },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Merged Cell' }] }]
            }
          ]
        }
      ]
    }
  ]
};

// ... try to use tiptap-markdown...
