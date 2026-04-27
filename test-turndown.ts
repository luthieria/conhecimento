import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const turndownService = new TurndownService({ headingStyle: 'atx' });
// turndownService.use(gfm);

// Rule to keep table as HTML instead of rendering as MMD
turndownService.keep(['table', 'colgroup', 'col']);

const html = `
<h1>Title</h1>
<p>Hello world!</p>
<table style="min-width: 50px">
  <colgroup>
    <col style="width: 200px">
    <col style="width: 300px">
  </colgroup>
  <tbody>
    <tr>
      <td style="background-color: red" colspan="2">Cell 1</td>
    </tr>
  </tbody>
</table>
`;

console.log(turndownService.turndown(html));
