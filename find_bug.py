import re, os

src_dir = r" C:\Users\kainm\TC ONLY\Mai Troll\src\

for root, dirs, files in os.walk(src_dir):
 for f in files:
 if f.endswith(('.tsx', '.ts')):
 path = os.path.join(root, f)
 try:
 with open(path, 'r', encoding='utf-8') as fh:
 content = fh.read()
 lines = content.split('\n')
 except:
 continue

 for i, line in enumerate(lines):
 stripped = line.strip()
 if '.subscribe(' in stripped or stripped == '.subscribe()':
 for j in range(i+1, min(i+10, len(lines))):
 next_stripped = lines[j].strip()
 if next_stripped.startswith('.on') and 'postgres_changes' in next_stripped:
 print(f'BUG FOUND in {path}:')
 print(f' Line {i+1}: {line.rstrip()}')
 print(f' Line {j+1}: {lines[j].rstrip()}')
 print()
 break
 if next_stripped and not next_stripped.startswith('//') and ('channel(' in next_stripped or '.subscribe()' in next_stripped or next_stripped.startswith('return ')):
 break
