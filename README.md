# Frostline Chat

Realtime chat app built with React + Vite + TypeScript and Firebase (Auth + Firestore).

## Features
- Six-digit ID sign-in (mapped to Firebase Auth email/password).
- Live chat updates via Firestore.
- Simple chat discovery by ID.

## Setup

1) Create a Firebase project.
2) Enable Email/Password in Authentication.
3) Create a Firestore database in production or test mode.
4) Create a web app in the Firebase console and copy the config values.

Create a `.env` file from `.env.example` and fill in the values:

```bash
cp .env.example .env
```

Then install and run the app:

```bash
npm install
npm run dev
```

## Firebase notes
- The six-digit ID is converted to an email like `123456@chat.local` for Firebase Auth.
- Firestore rules live in `firestore.rules`.
- If you deploy Firestore rules/indexes, the provided `firestore.indexes.json` includes the chat list index needed for `array-contains + orderBy(updatedAt)`.

## Scripts
- `npm run dev` starts the Vite dev server.
- `npm run build` builds the production bundle.
