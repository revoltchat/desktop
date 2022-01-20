#!/usr/bin/env bash

create-dmg \
  --volname "Revolt Installer" \
  --volicon "RevoltDMG.icns" \
  --background "background.png" \
  --window-pos 200 120 \
  --window-size 512 384 \
  --icon-size 80 \
  --icon "Revolt.app" 125 185 \
  --hide-extension "Revolt.app" \
  --app-drop-link 375 185 \
  "Revolt-Installer.dmg" \
  "source_folder/"