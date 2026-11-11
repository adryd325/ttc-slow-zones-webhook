#!/usr/bin/env bash
set -eu
cd state
git config --add --local core.sshCommand 'ssh -i ../id_ed25519_deploy_ttc-slow-zones'
git add .
git commit -m "automatic: Update $1" --no-gpg-sign
git push