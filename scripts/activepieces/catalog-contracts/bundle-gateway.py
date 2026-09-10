from pathlib import Path
root=Path(__file__).resolve().parent
p=root.parent/'employee-design/gateway.js';existing=p.read_text();suffix=existing[existing.index('const siteKnowledge455='):]
parts=[]
for f in [root/'catalog-contract.mjs',root/'catalog-selector.mjs',root.parent/'employee-design/factory-design.mjs',root.parent/'employee-design/chat-routing.mjs']:
 parts.append('\n'.join(line for line in f.read_text().replace('export ','').splitlines() if not line.startswith('import ')))
p.write_text('\n'.join(parts)+'\n'+suffix)
