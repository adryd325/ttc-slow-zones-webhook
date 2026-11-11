#!/usr/bin/env bash
set -eu
cd state
git config --add --local core.sshCommand 'ssh -i ../id_ed25519_deploy_ttc-slow-zones'
git add .
GIT_AUTHOR_DATE="$1" GIT_COMMITTER_DATE="$1" git commit -m "automatic: Update $2" --no-gpg-sign
git push