import json
import os

file_path = r'e:\Mai Troll-1\issues'

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    issues_by_type = {}
    
    for issue in data:
        name = issue.get('name')
        if name not in issues_by_type:
            issues_by_type[name] = []
        issues_by_type[name].append(issue)

    print(f"Total issues found: {len(data)}")
    print("-" * 30)

    for name, issues in issues_by_type.items():
        print(f"Issue Type: {name}")
        print(f"Count: {len(issues)}")
        
        if name == 'policy_exists_rls_disabled':
            tables = sorted(list(set(i['metadata']['name'] for i in issues if 'metadata' in i and 'name' in i['metadata'])))
            print(f"Tables affected ({len(tables)}):")
            # Print first 10 to verify, we will handle all in the fix
            print(", ".join(tables[:10]) + "...")
        else:
            # Print details for other issues to see what they are
            print(f"Sample detail: {issues[0].get('detail')}")
        
        print("-" * 30)

except Exception as e:
    print(f"Error reading or parsing file: {e}")
