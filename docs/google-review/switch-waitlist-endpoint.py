#!/usr/bin/env python3
"""Point an LWS public page at Siyadah after its database route is deployed.

Run on a private copy of the current page. The old webhook URL is matched but
never printed or written into this repository.
"""

import re
import sys
from pathlib import Path

TARGET = 'https://accounts.siyadah-ai.com/siyadah-api/v1/waitlist'
SOURCE = re.compile(r'var CONFIG = \{\n(?:(?!\n\};)[\s\S])*cloud\.activepieces\.com(?:(?!\n\};)[\s\S])*\n\};')


def switch(path: Path) -> None:
    html = path.read_text()
    changed, count = SOURCE.subn(lambda _match: f'var CONFIG = {{\n  endpoint: "{TARGET}"\n}};', html)
    if count != 1:
        raise RuntimeError(f'{path.name}: expected one legacy endpoint, found {count}')
    path.write_text(changed)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit('usage: switch-waitlist-endpoint.py PAGE [PAGE ...]')
    for argument in sys.argv[1:]:
        switch(Path(argument))
    print(f'Updated {len(sys.argv) - 1} page(s) to the Siyadah endpoint')
