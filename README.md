# Meme Vault

Your meme clips and sound effects, tagged by moment, saved in a "Meme Vault" folder in your Google Drive.

## Folder guide
- `app/` page setup and styles (`globals.css`)
- `components/` UI pieces: `MemeVault.js` (main screen), `ClipCard.js`, `ClipModal.js`, `Header.js`, `FilterBar.js`
- `lib/vaultStore.js` the library state and Drive syncing
- `lib/drive.js` Google sign-in and Drive API calls
- `lib/search.js` tag search
- `lib/config.js` situation chips, preset tags, search synonyms

## Settings
One environment variable: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (see `.env.example`).

## Run on your computer
```
npm install
npm run dev
```
Open http://localhost:3000 (add `http://localhost:3000` to the Google client's Authorized JavaScript origins).
