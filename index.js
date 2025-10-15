const fs = require('fs');
const path = require('path');
const readline = require('readline-sync');

const videosPath = path.join(process.env.USERPROFILE || process.env.HOME, 'Videos');
const picturesPath = path.join(process.env.USERPROFILE || process.env.HOME, 'Pictures');
let moveMedia;

// ...existing code...

// Configuration for file types and categories
const config = {
    typeMap: {
        'Word Documents': ['doc', 'docx'],
        'Videos': ['mp4', 'avi', 'mov', 'wmv', 'mkv', 'flv'],
        'PowerPoint': ['ppt', 'pptx'],
        'Executables': ['exe'],
        'Archives': ['zip', 'rar', '7z', 'tar', 'gz'],
        'PDFs': ['pdf'],
        'Text Files': ['txt', 'log']
    },
    imageExts: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'svg']
};

// Safe file moving with error handling and duplicate resolution
function safeRename(oldPath, newPath, operation = 'move') {
    try {
        // Check if destination already exists
        if (fs.existsSync(newPath)) {
            const stats = fs.lstatSync(oldPath);
            const newStats = fs.lstatSync(newPath);
            
            // If it's the same file, skip (already in place)
            if (stats.ino === newStats.ino && stats.dev === newStats.dev) {
                return false;
            }
            
            // Generate unique filename if file already exists at destination
            const parsed = path.parse(newPath);
            let counter = 1;
            while (fs.existsSync(newPath)) {
                newPath = path.join(parsed.dir, `${parsed.name} (${counter})${parsed.ext}`);
                counter++;
            }
        }
        
        fs.renameSync(oldPath, newPath);
        console.log(`${operation === 'move' ? 'Moved' : 'Grouped'} ${path.basename(oldPath)} to ${newPath}`);
        return true;
    } catch (error) {
        console.error(`Error ${operation === 'move' ? 'moving' : 'grouping'} ${oldPath}:`, error.message);
        return false;
    }
}

// Safely create directory if it doesn't exist
function createDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Find common show prefixes (e.g., 'The Simpsons') and group season folders
function groupSeasonFolders(dir) {
    if (!fs.existsSync(dir)) return;

    const folderNames = fs.readdirSync(dir).filter(item => {
        const fullPath = path.join(dir, item);
        return fs.lstatSync(fullPath).isDirectory();
    });

    const showMap = {};
    
    folderNames.forEach(folder => {
        // Match season folder pattern (e.g., "The Simpsons S01")
        const match = folder.match(/^(.*?)\s+S(\d{2})$/i);
        if (match) {
            // Extract show name (e.g., 'The Simpsons')
            const showPrefix = match[1].trim();
            const season = match[2];
            
            if (!showMap[showPrefix]) showMap[showPrefix] = [];
            showMap[showPrefix].push({ folder, season });
        }
    });

    // Move season folders under show folder if >= 2 seasons
    for (const [showPrefix, seasons] of Object.entries(showMap)) {
        if (seasons.length >= 2) {
            const showDir = path.join(dir, showPrefix);
            if (!fs.existsSync(showDir)) {
                fs.mkdirSync(showDir);
            }
            seasons.forEach(({ folder }) => {
                const oldPath = path.join(dir, folder);
                const newPath = path.join(showDir, folder);
                if (fs.existsSync(oldPath) && fs.lstatSync(oldPath).isDirectory()) {
                    safeRename(oldPath, newPath, 'group');
                    console.log(`Grouped ${folder} into ${showPrefix}/`);
                }
            });
        }
    }
}

// Group files by common prefix (e.g., 'The Simpsons S01')
function groupEpisodeFiles(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir).filter(item => {
        const fullPath = path.join(dir, item);
        return fs.lstatSync(fullPath).isFile();
    });

    const prefixMap = {};
    
    files.forEach(file => {
        // Extract prefix (e.g., 'The Simpsons S01') from episode files
        const match = file.match(/^(.*?\s+S\d{2})E\d{2}/i);
        if (match) {
            const prefix = match[1].trim();
            if (!prefixMap[prefix]) prefixMap[prefix] = [];
            prefixMap[prefix].push(file);
        }
    });

    // Create folders for prefixes with more than 2 files
    for (const [prefix, groupFiles] of Object.entries(prefixMap)) {
        if (groupFiles.length > 2) {
            const prefixDir = path.join(dir, prefix);
            if (!fs.existsSync(prefixDir)) {
                fs.mkdirSync(prefixDir);
            }
            groupFiles.forEach(file => {
                const oldPath = path.join(dir, file);
                const newPath = path.join(prefixDir, file);
                if (fs.existsSync(oldPath) && fs.lstatSync(oldPath).isFile()) {
                    safeRename(oldPath, newPath, 'group');
                    console.log(`Grouped ${file} into ${prefix}/`);
                }
            });
        }
    }
}

function organizeByType(dir) {
    if (!fs.existsSync(dir)) {
        console.error('Directory does not exist:', dir);
        return;
    }

    console.log(`Organizing directory: ${dir}`);
    
    // First, group TV show folders
    groupSeasonFolders(dir);
    
    // Then, group episode files
    groupEpisodeFiles(dir);

    // Re-read files after grouping
    const remainingFiles = fs.readdirSync(dir);
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'];
    
    let processedCount = 0;
    let errorCount = 0;

    remainingFiles.forEach(file => {
        const ext = path.extname(file).slice(1).toLowerCase();
        let targetFolder = 'Others';
        let moveToSystem = false;
        let systemPath = '';

        // Define file type groups and find appropriate category
        const typeMap = {
            'Word Documents': ['doc', 'docx'],
            'Videos': ['mp4', 'avi', 'mov', 'wmv', 'mkv', 'flv'],
            'PowerPoint': ['ppt', 'pptx'],
            'Executables': ['exe']
        };

        for (const [folder, extensions] of Object.entries(typeMap)) {
            if (extensions.includes(ext)) {
                targetFolder = folder;
                break;
            }
        }

        // Handle media files movement if enabled
        if (moveMedia) {
            if (typeMap['Videos'].includes(ext)) {
                moveToSystem = true;
                systemPath = videosPath;
            } else if (imageExts.includes(ext)) {
                moveToSystem = true;
                systemPath = picturesPath;
            }
        }

        const oldPath = path.join(dir, file);
        
        try {
            if (moveToSystem && fs.existsSync(systemPath)) {
                const newPath = path.join(systemPath, file);
                if (fs.lstatSync(oldPath).isFile()) {
                    if (safeRename(oldPath, newPath)) {
                        processedCount++;
                    } else {
                        errorCount++;
                    }
                    console.log(`Moved ${file} to ${systemPath}`);
                }
            } else {
                const targetDir = path.join(dir, targetFolder);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir);
                }
                const newPath = path.join(targetDir, file);
                if (fs.lstatSync(oldPath).isFile()) {
                    if (safeRename(oldPath, newPath)) {
                        processedCount++;
                    } else {
                        errorCount++;
                    }
                    console.log(`Moved ${file} to ${targetFolder}/`);
                }
            }
        } catch (error) {
            console.error(`Error processing ${file}:`, error.message);
            errorCount++;
        }
    });

    console.log(`Organization complete! Processed: ${processedCount}, Errors: ${errorCount}`);
}

// Startup prompt for directory
const userProfile = process.env.USERPROFILE || process.env.HOME;
const defaultDirs = {
    'downloads': path.join(userProfile, 'Downloads'),
    'documents': path.join(userProfile, 'Documents'),
    'pictures': path.join(userProfile, 'Pictures'),
    'videos': path.join(userProfile, 'Videos'),
    'desktop': path.join(userProfile, 'Desktop')
};

// Ask about media moving preference
const moveMediaInput = readline.question('Move media files (videos/images) to system folders? (y/N): ');
moveMedia = moveMediaInput.trim().toLowerCase() === 'y';

let inputDir = readline.question('What directory would you like to organize? (e.g., Downloads, C:/path/to/folder): ');
let targetDir = inputDir;
if (defaultDirs[inputDir.trim().toLowerCase()]) {
    targetDir = defaultDirs[inputDir.trim().toLowerCase()];
}

// Resolve relative paths
if (!path.isAbsolute(targetDir)) {
    targetDir = path.resolve(targetDir);
}

if (!fs.existsSync(targetDir)) {
    console.error('Directory does not exist:', targetDir);
    process.exit(1);
}

// Confirm before proceeding
console.log(`\nAbout to organize: ${targetDir}`);
const confirm = readline.question('Continue? (y/N): ');

if (confirm.trim().toLowerCase() === 'y') {
    organizeByType(targetDir);
} else {
    console.log('Operation cancelled.');
}