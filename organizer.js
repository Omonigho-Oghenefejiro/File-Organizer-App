const fs = require('fs');
const path = require('path');

const userProfile = process.env.USERPROFILE || process.env.HOME;
const videosPath = path.join(userProfile, 'Videos');
const picturesPath = path.join(userProfile, 'Pictures');
const defaultLogFilePath = path.join(__dirname, 'organizer-logs.jsonl');

function getDefaultDirs() {
    return {
        downloads: path.join(userProfile, 'Downloads'),
        documents: path.join(userProfile, 'Documents'),
        pictures: path.join(userProfile, 'Pictures'),
        videos: path.join(userProfile, 'Videos'),
        desktop: path.join(userProfile, 'Desktop'),
        series: path.join(userProfile, 'Videos', 'Series')
    };
}

function appendLog(entry, logFilePath = defaultLogFilePath) {
    try {
        const record = {
            timestamp: new Date().toISOString(),
            ...entry
        };
        fs.appendFileSync(logFilePath, `${JSON.stringify(record)}\n`, 'utf8');
    } catch (error) {
        console.error('Failed to write log entry:', error.message);
    }
}

function safeRename(oldPath, newPath, operation = 'move', logFilePath = defaultLogFilePath) {
    try {
        let finalPath = newPath;

        if (fs.existsSync(finalPath)) {
            const stats = fs.lstatSync(oldPath);
            const newStats = fs.lstatSync(finalPath);

            if (stats.ino === newStats.ino && stats.dev === newStats.dev) {
                appendLog(
                    {
                        action: operation,
                        status: 'skipped',
                        source: oldPath,
                        destination: finalPath,
                        message: 'Source and destination are the same file.'
                    },
                    logFilePath
                );
                return false;
            }

            const parsed = path.parse(finalPath);
            let counter = 1;
            while (fs.existsSync(finalPath)) {
                finalPath = path.join(parsed.dir, `${parsed.name} (${counter})${parsed.ext}`);
                counter += 1;
            }
        }

        fs.renameSync(oldPath, finalPath);
        appendLog(
            {
                action: operation,
                status: 'success',
                source: oldPath,
                destination: finalPath,
                message: `${path.basename(oldPath)} moved successfully.`
            },
            logFilePath
        );
        return true;
    } catch (error) {
        appendLog(
            {
                action: operation,
                status: 'error',
                source: oldPath,
                destination: newPath,
                message: error.message
            },
            logFilePath
        );
        return false;
    }
}

function sanitizeSeriesName(seriesName) {
    return seriesName
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractSeriesName(filename) {
    const extension = path.extname(filename);
    const baseName = path.basename(filename, extension).replace(/[._-]+/g, ' ');

    const seasonEpisodeMatch = baseName.match(/^(.+?)\s*[Ss]\d{1,2}[Ee]\d{1,2}/);
    if (seasonEpisodeMatch) {
        return sanitizeSeriesName(seasonEpisodeMatch[1]);
    }

    const seasonOnlyMatch = baseName.match(/^(.+?)\s*[Ss]\d{1,2}(?!\d)/);
    if (seasonOnlyMatch) {
        return sanitizeSeriesName(seasonOnlyMatch[1]);
    }

    return 'Unknown Series';
}

function generateStandardizedName(seriesName, seasonNum, episodeNum, extension) {
    return `${seriesName} S${seasonNum.padStart(2, '0')}E${episodeNum.padStart(2, '0')}${extension}`;
}

function groupBySeason(dir, options = {}) {
    const {
        logFilePath = defaultLogFilePath,
        logger = console.log
    } = options;

    if (!fs.existsSync(dir)) {
        logger('Directory does not exist!');
        return { movedCount: 0, errorCount: 1, seriesCount: 0 };
    }

    const files = fs.readdirSync(dir).filter(item => {
        const fullPath = path.join(dir, item);
        return fs.lstatSync(fullPath).isFile();
    });

    const seriesMap = {};

    files.forEach(file => {
        let season = null;
        let episode = null;
        let seriesName = extractSeriesName(file);
        const extension = path.extname(file);

        const seasonEpisodeMatch = file.match(/[Ss](\d{1,2})[Ee](\d{1,2})/i);
        if (seasonEpisodeMatch) {
            season = seasonEpisodeMatch[1];
            episode = seasonEpisodeMatch[2];
        }

        if (!season) {
            const compactMatch = file.match(/[Ss](\d{2})(\d{2})/i);
            if (compactMatch) {
                season = compactMatch[1];
                episode = compactMatch[2];
            }
        }

        if (!season) {
            const seasonOnlyMatch = file.match(/[Ss](\d{1,2})(?![0-9])/i);
            if (seasonOnlyMatch) {
                season = seasonOnlyMatch[1];
                episode = '01';
            }
        }

        if (!season && file.toLowerCase().includes('movie')) {
            season = 'Movies';
            seriesName = 'Movies';
        }

        if (!season) {
            return;
        }

        if (!seriesMap[seriesName]) {
            seriesMap[seriesName] = {};
        }
        if (!seriesMap[seriesName][season]) {
            seriesMap[seriesName][season] = [];
        }

        if (season === 'Movies') {
            seriesMap[seriesName][season].push({ original: file, standardized: file });
        } else {
            const standardized = generateStandardizedName(seriesName, season, episode, extension);
            seriesMap[seriesName][season].push({ original: file, standardized });
        }
    });

    const seriesNames = Object.keys(seriesMap);
    if (seriesNames.length === 0) {
        return { movedCount: 0, errorCount: 0, seriesCount: 0 };
    }

    let movedCount = 0;
    let errorCount = 0;

    seriesNames.forEach(seriesName => {
        const seriesDir = path.join(dir, seriesName);
        if (!fs.existsSync(seriesDir)) {
            fs.mkdirSync(seriesDir, { recursive: true });
        }

        const seasons = Object.keys(seriesMap[seriesName]).sort((a, b) => {
            if (a === 'Movies') return 1;
            if (b === 'Movies') return -1;
            return parseInt(a, 10) - parseInt(b, 10);
        });

        seasons.forEach(season => {
            const seasonLabel = season === 'Movies' ? 'Movies' : `Season ${season.padStart(2, '0')}`;
            const seasonDir = path.join(seriesDir, seasonLabel);
            if (!fs.existsSync(seasonDir)) {
                fs.mkdirSync(seasonDir, { recursive: true });
            }

            seriesMap[seriesName][season].forEach(fileInfo => {
                const oldPath = path.join(dir, fileInfo.original);
                const newPath = path.join(seasonDir, fileInfo.standardized);
                const moved = safeRename(oldPath, newPath, 'group', logFilePath);
                if (moved) {
                    movedCount += 1;
                } else {
                    errorCount += 1;
                }
            });
        });
    });

    logger(`Series organization complete. Series: ${seriesNames.length}, moved: ${movedCount}, errors: ${errorCount}`);
    return { movedCount, errorCount, seriesCount: seriesNames.length };
}

function organizeFilesByType(dir, options = {}) {
    const {
        logFilePath = defaultLogFilePath
    } = options;

    const files = fs.readdirSync(dir).filter(item => {
        const fullPath = path.join(dir, item);
        return fs.lstatSync(fullPath).isFile();
    });

    let processedCount = 0;
    let errorCount = 0;

    const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'mkv', 'flv', 'webm', 'm4v', '3gp'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'svg'];
    const documentExtensions = ['doc', 'docx', 'pdf', 'txt', 'rtf'];
    const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'];
    const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz', 'iso'];
    const executableExtensions = ['exe', 'msi', 'dmg', 'pkg'];
    const codeExtensions = ['js', 'html', 'css', 'py', 'java', 'cpp', 'c', 'php', 'xml', 'json'];

    files.forEach(file => {
        const oldPath = path.join(dir, file);

        try {
            const ext = path.extname(file).slice(1).toLowerCase();
            let targetFolder = 'Other Files';

            if (videoExtensions.includes(ext)) {
                targetFolder = 'Videos';
            } else if (imageExtensions.includes(ext)) {
                targetFolder = 'Images';
            } else if (documentExtensions.includes(ext)) {
                targetFolder = 'Documents';
            } else if (audioExtensions.includes(ext)) {
                targetFolder = 'Audio';
            } else if (archiveExtensions.includes(ext)) {
                targetFolder = 'Archives';
            } else if (executableExtensions.includes(ext)) {
                targetFolder = 'Executables';
            } else if (codeExtensions.includes(ext)) {
                targetFolder = 'Code';
            } else if (['ppt', 'pptx'].includes(ext)) {
                targetFolder = 'Presentations';
            } else if (['xls', 'xlsx'].includes(ext)) {
                targetFolder = 'Spreadsheets';
            }

            const targetDir = path.join(dir, targetFolder);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            const newPath = path.join(targetDir, file);
            if (safeRename(oldPath, newPath, 'move', logFilePath)) {
                processedCount += 1;
            } else {
                errorCount += 1;
            }
        } catch (error) {
            appendLog(
                {
                    action: 'move',
                    status: 'error',
                    source: oldPath,
                    destination: null,
                    message: error.message
                },
                logFilePath
            );
            errorCount += 1;
        }
    });

    return { processedCount, errorCount };
}

function organizeByType(dir, options = {}) {
    const {
        moveMedia = false,
        selectedVideosPath = videosPath,
        selectedPicturesPath = picturesPath,
        logFilePath = defaultLogFilePath,
        logger = console.log
    } = options;

    if (!fs.existsSync(dir)) {
        throw new Error(`Directory does not exist: ${dir}`);
    }

    const isDownloadsFolder = dir.toLowerCase().includes('downloads');
    const isRootVideosFolder = dir.toLowerCase() === selectedVideosPath.toLowerCase();
    const isSubfolderOfVideos = dir.toLowerCase().startsWith(selectedVideosPath.toLowerCase());

    if (isSubfolderOfVideos && !isRootVideosFolder) {
        return groupBySeason(dir, { logFilePath, logger });
    }

    if (isDownloadsFolder) {
        let totalProcessed = 0;
        let totalErrors = 0;

        if (moveMedia) {
            const files = fs.readdirSync(dir);
            const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'mkv', 'flv', 'webm', 'm4v', '3gp'];
            const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'svg'];

            files.forEach(file => {
                const oldPath = path.join(dir, file);

                if (!fs.lstatSync(oldPath).isFile()) {
                    return;
                }

                const ext = path.extname(file).slice(1).toLowerCase();
                let systemPath = null;

                if (videoExtensions.includes(ext)) {
                    systemPath = selectedVideosPath;
                } else if (imageExtensions.includes(ext)) {
                    systemPath = selectedPicturesPath;
                }

                if (!systemPath) {
                    return;
                }

                if (!fs.existsSync(systemPath)) {
                    fs.mkdirSync(systemPath, { recursive: true });
                }

                const newPath = path.join(systemPath, file);
                if (safeRename(oldPath, newPath, 'move', logFilePath)) {
                    totalProcessed += 1;
                } else {
                    totalErrors += 1;
                }
            });
        }

        const byTypeResult = organizeFilesByType(dir, { logFilePath });
        totalProcessed += byTypeResult.processedCount;
        totalErrors += byTypeResult.errorCount;

        return {
            processedCount: totalProcessed,
            errorCount: totalErrors
        };
    }

    return organizeFilesByType(dir, { logFilePath });
}

function getLogs(logFilePath = defaultLogFilePath, limit = 200) {
    if (!fs.existsSync(logFilePath)) {
        return [];
    }

    const content = fs.readFileSync(logFilePath, 'utf8').trim();
    if (!content) {
        return [];
    }

    const lines = content.split(/\r?\n/).filter(Boolean);
    const parsed = [];

    for (let index = lines.length - 1; index >= 0 && parsed.length < limit; index -= 1) {
        try {
            parsed.push(JSON.parse(lines[index]));
        } catch (error) {
            parsed.push({
                timestamp: new Date().toISOString(),
                action: 'log-parse',
                status: 'error',
                source: null,
                destination: null,
                message: 'Malformed log line skipped.'
            });
        }
    }

    return parsed;
}

module.exports = {
    organizeByType,
    getDefaultDirs,
    getLogs,
    defaultLogFilePath
};
