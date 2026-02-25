const fs = require('fs');
const path = require('path');
const readline = require('readline-sync');
const { organizeByType, getDefaultDirs } = require('./organizer');

let moveMedia = false;

const defaultDirs = getDefaultDirs();
defaultDirs.simpsons = 'C:\\Users\\Admin2\\Videos\\Series\\The Simpsons';

const moveMediaInput = readline.question('Move media files (videos/images) to system folders? (y/N): ');
moveMedia = moveMediaInput.trim().toLowerCase() === 'y';

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
        const result = organizeByType(targetDir, { moveMedia });
        console.log('Organization complete:', result);
    } catch (error) {
        console.error('Organization failed:', error.message);
        process.exit(1);
    }
} else {
    console.log('Operation cancelled.');
}
