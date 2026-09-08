"""Generate independent token ID fixtures; Python is only needed to regenerate them."""
import json
import os
from pathlib import Path
import tiktoken

root = Path(__file__).resolve().parents[1]
os.environ['TIKTOKEN_CACHE_DIR'] = str(root / '.cache' / 'tiktoken')
texts = [
    '', 'hello world', 'Hi!', 'café 🌱 中文 👩🏽‍💻',
    'e\u0301 café\r\n\t multiple   spaces  ',
    '<|endoftext|> <|im_start|> <|fim_prefix|>',
    '```js\nconst x = 42;\n```', '{"allow":false,"count":123456789}',
    'Do NOT delete the database. Return exactly BLOCK.',
    'العربية हिन्दी 日本語 한국어', '\u0000\uFFFD\u200b\u2028',
    'long background ' * 1500,
]
data = {'generator': 'Python tiktoken', 'version': tiktoken.__version__,
        'specialTokens': 'ordinary literal text (disallowed_special=())',
        'cases': [{'encoding': name, 'text': text,
                   'ids': tiktoken.get_encoding(name).encode(text, disallowed_special=())}
                  for name in ['o200k_base', 'cl100k_base', 'r50k_base'] for text in texts]}
target = root / 'tests' / 'fixtures' / 'tiktoken.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Generated {len(data["cases"])} fixtures using tiktoken {tiktoken.__version__}')
