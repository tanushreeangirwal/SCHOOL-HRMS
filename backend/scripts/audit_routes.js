const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../routes');
const files = fs.readdirSync(routesDir);

console.log('=== ROUTE ENDPOINTS AUDIT ===\n');

files.forEach(file => {
  if (!file.endsWith('.js')) return;
  const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
  console.log(`\n--- File: ${file} ---`);

  const regex = /router\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const endpoint = match[2];
    console.log(`  ${method.padEnd(7)} ${endpoint}`);
  }
});
