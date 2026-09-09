"""Targeted hardening fixtures, generated independently with Python tiktoken."""
import json
import os
from pathlib import Path
import tiktoken

root = Path(__file__).resolve().parents[1]
os.environ['TIKTOKEN_CACHE_DIR'] = str(root / '.cache' / 'tiktoken')
texts = ['a\ud800b\udc00c', '\u0000\u0001\u001b\t\r\n\u007f',
         '\u200b\u200d\u202eالعربية\u202c e\u0301 👩🏽‍💻',
         '<|endoftext|> <|im_start|> !!!???' + ' ' * 256]
cases = []
for name in ['o200k_base', 'cl100k_base', 'r50k_base']:
    codec = tiktoken.get_encoding(name)
    for text in texts:
        ids = codec.encode(text, disallowed_special=())
        cases.append(dict(encoding=name, text=text, ids=ids, decoded=codec.decode(ids)))
path = root / 'tests' / 'fixtures' / 'tiktoken-hardening.json'
path.write_text(json.dumps(dict(generator='Python tiktoken', version=tiktoken.__version__, cases=cases), ensure_ascii=True, indent=2)+'\n')
print(f'Generated {len(cases)} targeted fixtures with tiktoken {tiktoken.__version__}')
