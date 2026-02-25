# File Organizer App
Built solely by Omonigho-Okoro Oghenefejiro.

A Node.js file organizer with both CLI and GUI support. It groups files by type, organizes series by season, standardizes episode names, and writes timestamped logs for every operation.

## Features
- Organize files into type folders (Videos, Images, Documents, Audio, Archives, Code, and more)
- Organize series into `Series Name/Season XX` folder structure
- Standardize episode filenames to `Series Name S01E01.ext`
- Optional media routing from Downloads to system `Videos` / `Pictures`
- Preview mode (`dry-run`) to show planned moves/renames without changing files
- Undo last run (reverses successful move/group operations from the latest completed run)
- Include/Exclude filters for extensions and names (e.g., `.tmp`, `.git`, `node_modules`)
- Conflict-safe renaming with log entries for success, skipped, and error states
- GUI log viewer with live refresh

## Requirements
- Node.js 18+

## Setup
1. Install dependencies:
	- `npm install`

## Run the App
### GUI mode
1. Start the server:
	- `npm start`
2. Open:
	- `http://localhost:3000`
3. Enter a target directory (or choose a preset), choose whether to move media to system folders, then run organize.
4. Optional controls:
	- `Preview only (dry-run)` to simulate operations
	- Include-only extensions (comma-separated)
	- Exclude extensions (comma-separated)
	- Exclude names (comma-separated)
	- `Undo Last Run` to reverse the most recent completed run

### CLI mode
1. Start CLI mode:
	- `npm run cli`
2. Answer prompts:
	- Action: organize or undo last run
	- Whether to move media to system folders when organizing Downloads (`moveToSystemFolders` behavior)
	- Whether to run in preview mode (`dry-run`)
	- Optional include/exclude filters (comma-separated)
	- Which directory to organize (absolute path or preset keyword like `downloads`, `videos`, `series`)
	- Confirmation before execution

## Logs
- Log file path: `organizer-logs.jsonl`
- Log fields: `timestamp`, `action`, `status`, `source`, `destination`, `message`
- Each run is tagged with a `runId` to support undo and run grouping
- GUI displays recent logs via `/api/logs`

## API Endpoints (GUI backend)
- `GET /api/default-dirs` → returns preset directories
- `GET /api/logs?limit=300` → returns recent logs
- `POST /api/organize` with JSON body:
  - `directory` (string, required)
  - `moveToSystemFolders` (boolean, optional)
	- `dryRun` (boolean, optional)
	- `includeExtensions` (array of strings, optional)
	- `excludeExtensions` (array of strings, optional)
	- `excludeNames` (array of strings, optional)
- `POST /api/undo-last-run` with JSON body:
	- `dryRun` (boolean, optional)
	- `runId` (string, optional; if omitted, latest completed run is used)

## Example Episode Rename
- `The.Office.s1e1.mkv` → `The Office S01E01.mkv`
