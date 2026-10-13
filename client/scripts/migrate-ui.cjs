// One-time, idempotent migration. Preserve existing JSX formatting and handlers.
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const sourceRoot = path.resolve(__dirname, '../src');
const uiPath = path.join(sourceRoot, 'components/ui/index.jsx');

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  callback(node);
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'extra', 'comments', 'tokens'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(child => visit(child, callback));
    else if (value && typeof value === 'object') visit(value, callback);
  }
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { if (file !== path.join(sourceRoot, 'components/ui')) walk(file); continue; }
    if (!file.endsWith('.jsx')) continue;
    let source = fs.readFileSync(file, 'utf8');
    const replacements = [];
    const components = new Set();
    visit(parse(source, { sourceType: 'module', plugins: ['jsx'] }), node => {
      if (node.type !== 'JSXElement' || node.openingElement.name.type !== 'JSXIdentifier') return;
      const opening = node.openingElement;
      const tag = opening.name.name;
      let component = { button: 'Button', input: 'Input', textarea: 'Textarea', select: 'Select' }[tag];
      const classAttribute = opening.attributes.find(attr => attr.type === 'JSXAttribute' && attr.name.name === 'className');
      let classes = '';
      if (classAttribute?.value?.type === 'StringLiteral') classes = classAttribute.value.value;
      if (classAttribute?.value?.expression?.type === 'TemplateLiteral') classes = classAttribute.value.expression.quasis.map(item => item.value.raw).join(' ');
      if (tag === 'div' && /(^|\s)alert(\s|$)/.test(classes)) component = 'Alert';
      else if (['div', 'section', 'article'].includes(tag) && /(^|\s)(card|[\w-]+-card)(\s|$)/.test(classes)) component = 'Card';
      if (tag === 'span' && /(^|\s)badge(\s|$)/.test(classes)) component = 'Badge';
      if (!component) return;
      components.add(component);
      replacements.push({ start: opening.name.start, end: opening.name.end, text: component });
      if (node.closingElement) replacements.push({ start: node.closingElement.name.start, end: node.closingElement.name.end, text: component });
      if (component === 'Card' && tag !== 'div') replacements.push({ start: opening.name.end, end: opening.name.end, text: ` as="${tag}"` });
    });
    if (!replacements.length) continue;
    for (const change of replacements.sort((a, b) => b.start - a.start)) source = source.slice(0, change.start) + change.text + source.slice(change.end);
    let importPath = path.relative(path.dirname(file), uiPath).replace(/\\/g, '/');
    if (!importPath.startsWith('.')) importPath = `./${importPath}`;
    source = `import { ${[...components].sort().join(', ')} } from '${importPath}';\n${source}`;
    fs.writeFileSync(file, source);
    process.stdout.write(`${path.relative(sourceRoot, file)}: ${components.size} component types\n`);
  }
}
walk(sourceRoot);
