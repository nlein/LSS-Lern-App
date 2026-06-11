# LSS Lern-App

Expo React Native app for exam preparation: Lean Six Sigma Black Belt, PMI, and Scrum (PSM I / PSPO I).

## Features

- Spaced-repetition question selection (unseen-first round-robin + weight formula)
- Multiple-choice (single + multi) and open commission-style questions
- 30 modules across LSS, PMI, Scrum, Digitalization, and further specialisation topics
- Daily streak tracking and configurable reminders
- Dashboard with per-module accuracy stats
- Dark / light / system theme
- OTA updates via expo-updates
- Backup export & import (learning progress as JSON)

## Note on content

The question content (JSON files in `src/data/questions/`) is not included in this repository — it is bundled into the app at build time and delivered via OTA updates.

## Getting started

```bash
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app on your Android device.

## OTA update

```bash
eas update --channel production --message "..."
```

## Build APK

```bash
eas build --platform android --profile production
```

## License

MIT
