#!/bin/zsh
# Deploy the committed site (HEAD, never the working tree) to Cloudflare Pages, project "wekwos" (wekwos.com):
# the public files are exported with git archive, staged on erebus in /nvme-mirror/apps/wekwos/public, and deployed
# there with wrangler (logged in on erebus).
#     tools/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
STAGE=$(mktemp -d)
git archive HEAD index.html dictionary.html $(git ls-files --error-unmatch voices.html >/dev/null 2>&1 && echo voices.html) \
  _headers css js fonts art map data audio gardens tools/palette.json | tar -x -C "$STAGE"
# HOLD_VOICES=1 publishes without the voices page (and without its nav link) until it is approved
if [[ -n "${HOLD_VOICES:-}" ]]; then
  rm -rf "$STAGE"/voices.html "$STAGE"/css/voices.css "$STAGE"/js/voices.js "$STAGE"/data/voices*.json "$STAGE"/audio/voices "$STAGE"/art/voices \
    "$STAGE"/art/initials/voices "$STAGE"/art/garden-voices.webp "$STAGE"/art/growth-voices.webm "$STAGE"/art/growth-voices
  sed -i '' "/'voices', 'Voices', 'voices.html'/d" "$STAGE"/js/nav.js
fi
echo "$(find "$STAGE" -type f | wc -l | tr -d ' ') files, $(du -sh "$STAGE" | cut -f1)"
rsync -a --delete "$STAGE"/ erebus:/nvme-mirror/apps/wekwos/public/
rm -rf "$STAGE"
ssh erebus 'cd /nvme-mirror/apps/wekwos && /nvme-mirror/apps/sref-viewer-cf/node_modules/.bin/wrangler pages deploy public --project-name wekwos --branch main --commit-dirty=true 2>&1 | tail -2'
