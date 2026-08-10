#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-or-later

set -euo pipefail

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_dir"

node --check extension.js
bash -n examples/polkit/polkit-session-locked

polkit_tmp=$(mktemp --suffix=.js)
trap 'rm -f "$polkit_tmp"' EXIT
cp examples/polkit/10-network-lockdown.rules "$polkit_tmp"
node --check "$polkit_tmp"

python3 - <<'PY'
import json
from pathlib import Path

uuid = 'lock-screen-connectivity-guard@malz101.github.io'

system = json.loads(Path('metadata.json').read_text(encoding='utf-8'))
ego = json.loads(Path('packaging/metadata.ego.json').read_text(encoding='utf-8'))

for label, metadata in [('system', system), ('ego', ego)]:
    assert metadata['uuid'] == uuid, f'{label}: unexpected UUID'
    assert metadata['name'] == 'Lock Screen Connectivity Guard'
    assert metadata['shell-version'] == ['50']
    assert 'version' not in metadata

assert system['session-modes'] == ['user', 'unlock-dialog', 'gdm']
assert ego['session-modes'] == ['user', 'unlock-dialog']
PY

if grep -RInE \
    'malz@|\[sudo|Password:|hp-pavillion|HP-Pavilion|lockscreen-network-guard@local' \
    --exclude-dir=.git \
    --exclude-dir=build \
    --exclude-dir=dist \
    --exclude-dir=node_modules \
    --exclude=README.md \
    --exclude=validate.sh \
    .; then
    echo 'Repository hygiene check failed' >&2
    exit 1
fi

empty_tree=$(git hash-object -t tree /dev/null)
git diff --check "$empty_tree" HEAD
git diff --check
git diff --cached --check

echo 'Validation passed.'
