# File Organizer App
Built Solely by Omonigho-Okoro Oghenefejiro
A Node.js file organizer with both CLI and GUI. It moves, renames, and sorts files by type/series and keeps timestamped movement logs.

## Features
- Organize files by type
- Organize series into `Series Name/Season XX` folders
- Standardize episode names to `Series Name S01E01.ext`
- Move media files to system folders (optional)
- Log every movement/rename with date and time
- View logs in GUI

## Usage
1. Install dependencies: `npm install`

### Run GUI
- Start server: `npm start`
- Open: `http://localhost:3000`
- Use the form to run organization and view movement logs.

### Run CLI
- Start CLI mode: `npm run cli`

## Logs
- Logs are stored in `organizer-logs.jsonl`.
- Each entry includes timestamp, action, status, source path, destination path, and message.

## Example Episode Rename
- `The.Office.s1e1.mkv` becomes `The Office S01E01.mkv`
