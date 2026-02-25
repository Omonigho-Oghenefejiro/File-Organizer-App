const fs = require('fs');
const path = require('path');
const readline = require('readline-sync');
const { organizeByType, undoLastRun, getDefaultDirs } = require('./organizer');

const action = readline.question('Choose action: [o]rganize or [u]ndo last run? (o/u): ').trim().toLowerCase();

if (action === 'u') {
    const dryRunUndo = readline.question('Preview undo only (dry-run)? (y/N): ').trim().toLowerCase() === 'y';

    try {
        const undoResult = undoLastRun({ dryRun: dryRunUndo });
        console.log('Undo result:', undoResult);
        process.exit(0);
    } catch (error) {
        console.error('Undo failed:', error.message);
        process.exit(1);
    }
}

let moveToSystemFolders = false;

const defaultDirs = getDefaultDirs();
defaultDirs.simpsons = 'C:\\Users\\Admin2\\Videos\\Series\\The Simpsons';

const moveToSystemFoldersInput = readline.question('When organizing Downloads folder, move images to Pictures and videos to Videos? (y/N): ');
moveToSystemFolders = moveToSystemFoldersInput.trim().toLowerCase() === 'y';

const dryRunInput = readline.question('Run in preview mode (dry-run, no files moved)? (y/N): ');
const dryRun = dryRunInput.trim().toLowerCase() === 'y';

const includeInput = readline.question('Include only extensions (comma-separated, optional, e.g. mp4,mkv): ');
const excludeExtInput = readline.question('Exclude extensions (comma-separated, optional, e.g. tmp,log): ');
const excludeNamesInput = readline.question('Exclude names (comma-separated, optional, e.g. .git,node_modules): ');

const parseList = value => value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const includeExtensions = includeInput ? parseList(includeInput) : [];
const excludeExtensions = excludeExtInput ? parseList(excludeExtInput) : [];
const excludeNames = excludeNamesInput ? parseList(excludeNamesInput) : [];

const inputDir = readline.question('What directory would you like to organize? (e.g., Downloads, C:/path/to/folder): ');
let targetDir = inputDir;

if (defaultDirs[inputDir.trim().toLowerCase()]) {
    targetDir = defaultDirs[inputDir.trim().toLowerCase()];
}

if (!path.isAbsolute(targetDir)) {
    targetDir = path.resolve(targetDir);
}

if (!fs.existsSync(targetDir)) {
    console.error('Directory does not exist:', targetDir);
    process.exit(1);
}

console.log(`\nAbout to organize: ${targetDir}`);
const confirm = readline.question('Continue? (y/N): ');

if (confirm.trim().toLowerCase() === 'y') {
    try {
        const result = organizeByType(targetDir, {
            moveToSystemFolders,
            dryRun,
            includeExtensions,
            excludeExtensions,
            excludeNames
        });
        console.log('Organization complete:', result);
    } catch (error) {
        console.error('Organization failed:', error.message);
        process.exit(1);
    }
} else {
    console.log('Operation cancelled.');
}
