#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-or-later

set -euo pipefail

variant=${1:-}
repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
uuid='lock-screen-connectivity-guard@malz101.github.io'
version='1.0.0'

case "$variant" in
    system)
        metadata="$repo_dir/metadata.json"
        output_name="lock-screen-connectivity-guard-v${version}-system.zip"
        ;;
    ego)
        metadata="$repo_dir/packaging/metadata.ego.json"
        output_name="lock-screen-connectivity-guard-v${version}-ego.zip"
        ;;
    *)
        echo 'Usage: scripts/build-package.sh system|ego' >&2
        exit 2
        ;;
esac

for command in gnome-extensions unzip; do
    if ! command -v "$command" >/dev/null; then
        echo "Required command not found: $command" >&2
        exit 1
    fi
done

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

stage_dir="$work_dir/$uuid"
pack_dir="$work_dir/packed"
mkdir -p "$stage_dir" "$pack_dir" "$repo_dir/dist"

install -m 0644 "$repo_dir/extension.js" "$stage_dir/extension.js"
install -m 0644 "$metadata" "$stage_dir/metadata.json"

gnome-extensions pack \
    --force \
    --out-dir "$pack_dir" \
    "$stage_dir"

generated="$pack_dir/$uuid.shell-extension.zip"
if [[ ! -f "$generated" ]]; then
    echo "Expected package was not generated: $generated" >&2
    exit 1
fi

mapfile -t entries < <(unzip -Z1 "$generated" | LC_ALL=C sort)
expected=('extension.js' 'metadata.json')

if [[ "${entries[*]}" != "${expected[*]}" ]]; then
    printf 'Unexpected package contents:\n%s\n' "${entries[*]}" >&2
    exit 1
fi

install -m 0644 "$generated" "$repo_dir/dist/$output_name"
echo "$repo_dir/dist/$output_name"
