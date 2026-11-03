const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/docs/swagger.json'), 'utf8');
JSON.parse(source);
const target = path.join(__dirname, '../../docs/swagger-web/openapi.json');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== source) {
    console.error('Static OpenAPI is out of date. Run npm run docs:sync in server/.');
    process.exitCode = 1;
  }
} else {
  fs.writeFileSync(target, source);
}
