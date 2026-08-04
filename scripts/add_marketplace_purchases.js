import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const part06Path = join(process.cwd(), 'supabase/migrations/20260727180000_initial_schema_part06.sql');
const part06 = readFileSync(part06Path, 'utf8');

const marketplacePurchases = `
-- Table: marketplace_purchases
CREATE TABLE IF NOT EXISTS marketplace_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES user_profiles(id),
    item_id UUID REFERENCES marketplace_items(id),
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const newPart06 = part06 + marketplacePurchases;
writeFileSync(part06Path, newPart06, 'utf8');
console.log('Added marketplace_purchases to part06');
