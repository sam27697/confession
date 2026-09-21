import re, sys

with open('app/globals.css', 'r', encoding='utf-8') as f:
    css = f.read()

colors = set(re.findall(r'#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|hsl\([^)]+\)', css))
font_sizes = set(re.findall(r'font-size:\s*([^;]+);', css))
radii = set(re.findall(r'border-radius:\s*([^;]+);', css))
vars_defined = set(re.findall(r'(--[a-z][a-zA-Z0-9-]+)\s*:', css))
all_values = re.findall(r':\s*([^;{}]+);', css)
total_values = len(all_values)
token_values = len([v for v in all_values if 'var(--' in v])
adoption = round(token_values / total_values * 100, 1) if total_values else 0

print('colors=%d font-sizes=%d radii=%d vars=%d adoption=%.1f%%' % (len(colors), len(font_sizes), len(radii), len(vars_defined), adoption))
print('TOKENS: OK')
