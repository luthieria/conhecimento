const text = `Here is some inline math: $x^2 + y^2 = z^2$ and some block math:
$$
\frac{1}{2}
$$
And more $a$ and $$b$$.`;

const result = text
  .replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) => `<span data-type="inlineMath" data-latex="${latex.trim().replace(/"/g, '&quot;')}" data-display="yes"></span>`)
  .replace(/(?<!\$)\$([^$]+?)\$(?!\$)/g, (_, latex) => `<span data-type="inlineMath" data-latex="${latex.trim().replace(/"/g, '&quot;')}" data-display="no"></span>`);

console.log(result);
