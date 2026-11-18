#!/bin/sh
# Explicit SDK path only: never changes global PATH, Xcode selection or credentials.
set -eu
: "${FLUTTER_SDK:?Set FLUTTER_SDK to the verified Flutter 3.50.0 SDK directory}"
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
export CI=true FLUTTER_SUPPRESS_ANALYTICS=true
FLUTTER="$FLUTTER_SDK/bin/flutter"
VERSION=$($FLUTTER --version --machine)
printf '%s' "$VERSION" | python3 -c 'import json,sys; v=json.load(sys.stdin); assert v["frameworkVersion"]=="3.50.0" and v["frameworkRevision"]=="ab2912035e160d9cad6306df307576da6128ebdb", "Pinned Flutter SDK required"'
cd "$ROOT/apps/mobile"
"$FLUTTER" pub get --enforce-lockfile
"$FLUTTER_SDK/bin/dart" format --output=none --set-exit-if-changed lib test integration_test
"$FLUTTER" analyze --fatal-infos
"$FLUTTER" test --reporter expanded
