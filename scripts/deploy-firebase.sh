#!/usr/bin/env bash
set -euo pipefail

echo "Checking Firebase CLI..."
if ! command -v firebase >/dev/null 2>&1; then
  echo "firebase CLI not found. Please install it: https://firebase.google.com/docs/cli#install_the_firebase_cli"
  exit 1
fi

echo "Deploying Firestore rules and Storage rules..."
firebase deploy --only firestore:rules,storage

echo "Deployment finished."
