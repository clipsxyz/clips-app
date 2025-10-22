import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the database schema file
const schemaPath = path.join(__dirname, '..', '..', 'database_schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

// Split schema into individual statements
const statements = schema
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

console.log(`📊 Found ${statements.length} SQL statements to execute`);

export { statements };
