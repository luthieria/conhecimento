import TurndownService from 'turndown';
const html = `<span data-type="inlineMath" data-latex="x^2" data-evaluate="no" data-display="yes">$$x^2$$</span><span data-type="inlineMath" data-latex="y^2" data-evaluate="no" data-display="no">$y^2$</span>`;
const turndownService = new TurndownService();
turndownService.addRule('inlineMath', {
  filter: (node, options) => {
    return node.nodeName === 'SPAN' && node.getAttribute('data-type') === 'inlineMath';
  },
  replacement: (content, node, options) => {
    const isDisplay = node.getAttribute('data-display') === 'yes';
    const latex = node.getAttribute('data-latex');
    return isDisplay ? `\n$$\n${latex}\n$$\n` : `$${latex}$`;
  }
});
console.log(turndownService.turndown(html));
