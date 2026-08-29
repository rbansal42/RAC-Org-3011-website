import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const itemsToDelete = [
  'src/components/Tier1',
  'src/components/Tier2',
  'src/components/Tier3',
  'src/components/Common',
  'src/components/DistrictAccess',
  'src/components/Portal',
  'src/components/PresidentAccess',
  'src/components/PublicHome',
  'src/data/userRegistry.js',
  '!c.email',
  '({',
  'Email',
  "console.error('Fetch",
  'excel_parser_temp.html',
  'build_complete_sql_seed.js',
  'parse_databases.js',
  'supabase_setup.sql',
  'supabase_seed_all_officers.sql',
  'cleanup_security.js'
];

console.log('Cleaning unused legacy files, temporary SQL seeds, and parser scripts...');
itemsToDelete.forEach(relPath => {
  const fullPath = path.join(__dirname, relPath);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`Deleted: ${relPath}`);
  }
});
console.log('Clean complete!');
