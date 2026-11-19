#!/usr/bin/env bash
set -euo pipefail
# Prepare only. Does not build, install, inspect devices, or change source repo.
root="$(cd "$(dirname "$0")/../.." && pwd)"
out="$(mktemp -d "${TMPDIR:-/tmp}/nolleoon-receipt-probe.XXXXXX")"
git -C "$root" archive HEAD | tar -x -C "$out"
python3 - "$out/apps/mobile/android/app/build.gradle.kts" <<'PY'
import pathlib, sys
p=pathlib.Path(sys.argv[1]); s=p.read_text()
needle='    buildTypes {\n'
if s.count(needle)!=1: raise SystemExit('Unexpected debug build definition')
s=s.replace(needle, needle+'        debug {\n            applicationIdSuffix = ".receiptprobe"\n        }\n',1)
p.write_text(s)
PY
printf 'Prepared isolated debug source: %s\n' "$out"
printf 'Build only this target: flutter build apk --debug --target test_targets/receipt_process_probe.dart\n'
printf 'Expected applicationId: com.kukjun.nolleoon.receiptprobe\n'
