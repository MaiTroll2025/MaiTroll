import re, os
from pathlib import Path

src = Path('src')
tables = set()
rpcs = set()
columns = set()
storage_buckets = set()

for f in src.rglob('*.tsx'):
    if 'node_modules' in str(f): continue
    text = f.read_text(errors='ignore')
    for m in re.finditer(r"\.from\s*\(\s*['\"]([^'\"]+)['\"]", text):
        tables.add(m.group(1))
    for m in re.finditer(r"\.rpc\s*\(\s*['\"]([^'\"]+)['\"]", text):
        rpcs.add(m.group(1))
    for m in re.finditer(r"\.storage\.from\s*\(\s*['\"]([^'\"]+)['\"]", text):
        storage_buckets.add(m.group(1))
    for m in re.finditer(r"\.select\s*\(\s*['\"]([^'\"]+)['\"]", text):
        cols = m.group(1).replace(',', ' ').split()
        columns.update(c.strip('*,') for c in cols if c.strip('*,') and not c.startswith('count') and not c.startswith('*') and len(c.strip('*,')) > 0)
    for m in re.finditer(r"\.insert\s*\(\s*\{[^}]*\b([A-Za-z_][A-Za-z0-9_]*)\s*:", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.update\s*\(\s*\{[^}]*\b([A-Za-z_][A-Za-z0-9_]*)\s*:", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.eq\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.order\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.ilike\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.like\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.neq\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.in\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.contains\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.overlaps\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.gt\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.gte\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.lt\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.lte\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.or\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.match\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.not\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))

for f in src.rglob('*.ts'):
    if 'node_modules' in str(f): continue
    text = f.read_text(errors='ignore')
    for m in re.finditer(r"\.from\s*\(\s*['\"]([^'\"]+)['\"]", text):
        tables.add(m.group(1))
    for m in re.finditer(r"\.rpc\s*\(\s*['\"]([^'\"]+)['\"]", text):
        rpcs.add(m.group(1))
    for m in re.finditer(r"\.storage\.from\s*\(\s*['\"]([^'\"]+)['\"]", text):
        storage_buckets.add(m.group(1))
    for m in re.finditer(r"\.select\s*\(\s*['\"]([^'\"]+)['\"]", text):
        cols = m.group(1).replace(',', ' ').split()
        columns.update(c.strip('*,') for c in cols if c.strip('*,') and not c.startswith('count') and not c.startswith('*') and len(c.strip('*,')) > 0)
    for m in re.finditer(r"\.insert\s*\(\s*\{[^}]*\b([A-Za-z_][A-Za-z0-9_]*)\s*:", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.update\s*\(\s*\{[^}]*\b([A-Za-z_][A-Za-z0-9_]*)\s*:", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.eq\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.order\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.ilike\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.like\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.neq\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.in\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.contains\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.overlaps\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.gt\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.gte\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.lt\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.lte\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.or\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.match\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))
    for m in re.finditer(r"\.not\s*\(\s*['\"]([^'\"]+)['\"]", text):
        columns.add(m.group(1))

columns.discard('Array')
columns.discard('from')
columns.discard('key')
columns.discard('ref')

print('=== TABLES ===')
for t in sorted(tables):
    print(t)
print(f'\nTotal tables: {len(tables)}')

print('\n=== RPC FUNCTIONS ===')
for r in sorted(rpcs):
    print(r)
print(f'\nTotal RPCs: {len(rpcs)}')

print('\n=== STORAGE BUCKETS ===')
for s in sorted(storage_buckets):
    print(s)
print(f'\nTotal storage buckets: {len(storage_buckets)}')

print('\n=== COLUMNS ===')
for c in sorted(columns):
    print(c)
print(f'\nTotal columns: {len(columns)}')
