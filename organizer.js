const fs = require('fs');
const path = require('path');

const userProfile = process.env.USERPROFILE || process.env.HOME;
const videosPath = path.join(userProfile, 'Videos');
const picturesPath = path.join(userProfile, 'Pictures');
const defaultLogFilePath = path.join(__dirname, 'organizer-logs.jsonl');

const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'mkv', 'flv', 'webm', 'm4v', '3gp'];
const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'svg'];
const documentExtensions = ['doc', 'docx', 'pdf', 'txt', 'rtf'];
const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'];
const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz', 'iso'];
const executableExtensions = ['exe', 'msi', 'dmg', 'pkg'];
const codeExtensions = ['js', 'html', 'css', 'py', 'java', 'cpp', 'c', 'php', 'xml', 'json'];

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

function generateRunId() {
    return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function readLogLines(logFilePath = defaultLogFilePath) {
    if (!fs.existsSync(logFilePath)) {
        return [];
    }

    const content = fs.readFileSync(logFilePath, 'utf8').trim();
    if (!content) {
        return [];
    }

    return content
        .split(/\r?\n/)
        .filter(Boolean)
        .map(line => {
            try {
                return JSON.parse(line);
            } catch (error) {
                return null;
            }
        })
        .filter(Boolean);
}

function normalizeList(value) {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value
            .map(item => String(item).trim().toLowerCase())
            .filter(Boolean);
    }

    return String(value)
        .split(',')
        .map(item => item.trim().toLowerCase())
        .filter(Boolean);
}

function normalizeOptions(options = {}) {
    return {
        ...options,
        includeExtensions: normalizeList(options.includeExtensions),
        excludeExtensions: normalizeList(options.excludeExtensions),
        excludeNames: normalizeList(options.excludeNames)
    };
}

function getFileExtension(filename) {
    return path.extname(filename).replace(/^\./, '').toLowerCase();
}

function shouldSkipEntry(entryName, options = {}) {
    const includeExtensions = options.includeExtensions || [];
    const excludeExtensions = options.excludeExtensions || [];
    const excludeNames = options.excludeNames || [];
    const normalizedName = entryName.trim().toLowerCase();
    const ext = getFileExtension(entryName);

    if (excludeNames.includes(normalizedName)) {
        return true;
    }

    if (excludeExtensions.includes(ext)) {
        return true;
    }

    if (includeExtensions.length > 0 && !includeExtensions.includes(ext)) {
        return true;
    }

    return false;
}

function getTargetFolderByExtension(ext) {
    if (videoExtensions.includes(ext)) return 'Videos';
    if (imageExtensions.includes(ext)) return 'Images';
    if (documentExtensions.includes(ext)) return 'Documents';
    if (audioExtensions.includes(ext)) return 'Audio';
    if (archiveExtensions.includes(ext)) return 'Archives';
    if (executableExtensions.includes(ext)) return 'Executables';
    if (codeExtensions.includes(ext)) return 'Code';
    if (['ppt', 'pptx'].includes(ext)) return 'Presentations';
    if (['xls', 'xlsx'].includes(ext)) return 'Spreadsheets';
    return 'Other Files';
}

function getAvailablePath(oldPath, targetPath) {
    let finalPath = targetPath;

    if (!fs.existsSync(finalPath)) {
        return { finalPath, sameFile: false };
    }

    const oldStats = fs.lstatSync(oldPath);
    const newStats = fs.lstatSync(finalPath);
    if (oldStats.ino === newStats.ino && oldStats.dev === newStats.dev) {
        return { finalPath, sameFile: true };
    }

    const parsed = path.parse(finalPath);
    let counter = 1;
    while (fs.existsSync(finalPath)) {
        finalPath = path.join(parsed.dir, `${parsed.name} (${counter})${parsed.ext}`);
        counter += 1;
    }

    return { finalPath, sameFile: false };
}

function safeRename(oldPath, newPath, operation = 'move', logFilePath = defaultLogFilePath, options = {}) {
    const { dryRun = false, runId = null, preview = [] } = options;

    try {
        const { finalPath, sameFile } = getAvailablePath(oldPath, newPath);

        if (sameFile) {
            appendLog(
                {
                    runId,
                    action: operation,
                    status: dryRun ? 'preview' : 'skipped',
                    source: oldPath,
                    destination: finalPath,
                    message: 'Source and destination are the same file.'
                },
                logFilePath
            );

            preview.push({ action: operation, source: oldPath, destination: finalPath, status: 'skipped' });
            return false;
        }

        if (dryRun) {
            appendLog(
                {
                    runId,
                    action: operation,
                    status: 'preview',
                    source: oldPath,
                    destination: finalPath,
                    message: `${path.basename(oldPath)} would be moved.`
                },
                logFilePath
            );
            preview.push({ action: operation, source: oldPath, destination: finalPath, status: 'preview' });
            return true;
        }

        fs.renameSync(oldPath, finalPath);
        appendLog(
            {
                runId,
                action: operation,
                status: 'success',
                source: oldPath,
                destination: finalPath,
                message: `${path.basename(oldPath)} moved successfully.`
            },
            logFilePath
        );
        preview.push({ action: operation, source: oldPath, destination: finalPath, status: 'success' });
        return true;
    } catch (error) {
        appendLog(
            {
                runId,
                action: operation,
                status: 'error',
                source: oldPath,
                destination: newPath,
                message: error.message
            },
            logFilePath
        );
        preview.push({ action: operation, source: oldPath, destination: newPath, status: 'error', message: error.message });
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

    const seasonEpisodeMatch = baseName.match(/^(.+?)\s*[Ss]\d{1,2}\s*[Ee][Pp]?\s*\d{1,2}/);
    if (seasonEpisodeMatch) {
        let seriesWithQuality = sanitizeSeriesName(seasonEpisodeMatch[1]);
        seriesWithQuality = seriesWithQuality.replace(/\b(480p|720p|1080p|2160p|4k|8k|uhd|hd|sd)\b/gi, '');
        seriesWithQuality = seriesWithQuality.replace(/\b(repack|proper|dirfix|dvdrip|webrip|hdtv|bluray)\b/gi, '');
        return sanitizeSeriesName(seriesWithQuality);
    }

    const seasonOnlyMatch = baseName.match(/^(.+?)\s*[Ss]\d{1,2}(?!\d)/);
    if (seasonOnlyMatch) {
        let seriesWithQuality = sanitizeSeriesName(seasonOnlyMatch[1]);
        seriesWithQuality = seriesWithQuality.replace(/\b(480p|720p|1080p|2160p|4k|8k|uhd|hd|sd)\b/gi, '');
        seriesWithQuality = seriesWithQuality.replace(/\b(repack|proper|dirfix|dvdrip|webrip|hdtv|bluray)\b/gi, '');
        return sanitizeSeriesName(seriesWithQuality);
    }

    return 'Unknown Series';
}

function extractSeasonEpisode(filename) {
    const normalized = path.basename(filename, path.extname(filename)).replace(/[._-]+/g, ' ');

    const seasonEpisodeMatch = normalized.match(/[Ss](\d{1,2})\s*[Ee][Pp]?\s*(\d{1,2})/i);
    if (seasonEpisodeMatch) {
        return {
            season: seasonEpisodeMatch[1],
            episode: seasonEpisodeMatch[2]
        };
    }

    const compactMatch = normalized.match(/[Ss](\d{2})(\d{2})/i);
    if (compactMatch) {
        return {
            season: compactMatch[1],
            episode: compactMatch[2]
        };
    }

    const xMatch = normalized.match(/(\d{1,2})x(\d{1,2})/i);
    if (xMatch) {
        return {
            season: xMatch[1],
            episode: xMatch[2]
        };
    }

    const seasonOnlyMatch = normalized.match(/[Ss](\d{1,2})(?!\d)/i);
    if (seasonOnlyMatch) {
        return {
            season: seasonOnlyMatch[1],
            episode: '01'
        };
    }

    return {
        season: null,
        episode: null
    };
}

function generateStandardizedName(seriesName, seasonNum, episodeNum, extension) {
    return `${seriesName} S${seasonNum.padStart(2, '0')}E${episodeNum.padStart(2, '0')}${extension}`;
}

function safeRenameForSeries(oldPath, newPath, operation = 'group', logFilePath = defaultLogFilePath, options = {}) {
    const { dryRun = false, runId = null, preview = [] } = options;

    try {
        let finalPath = newPath;

        if (fs.existsSync(finalPath)) {
            const oldStats = fs.lstatSync(oldPath);
            const newStats = fs.lstatSync(finalPath);

            if (oldStats.ino === newStats.ino && oldStats.dev === newStats.dev) {
                appendLog(
                    {
                        runId,
                        action: operation,
                        status: dryRun ? 'preview' : 'skipped',
                        source: oldPath,
                        destination: finalPath,
                        message: 'Source and destination are the same file.'
                    },
                    logFilePath
                );
                preview.push({ action: operation, source: oldPath, destination: finalPath, status: 'skipped' });
                return false;
            }

            const parsed = path.parse(finalPath);
            const originalNameWithoutExt = path.basename(oldPath, path.extname(oldPath));
            const suffixMatch = originalNameWithoutExt.match(/\s+(.*?)$/);
            const suffix = suffixMatch ? suffixMatch[1] : null;

            if (suffix && suffix.length < 50) {
                const withSuffixPath = path.join(parsed.dir, `${parsed.name} ${suffix}${parsed.ext}`);
                if (!fs.existsSync(withSuffixPath)) {
                    finalPath = withSuffixPath;
                }
            }

            if (fs.existsSync(finalPath)) {
                let counter = 1;
                finalPath = path.join(parsed.dir, `${parsed.name} (${counter})${parsed.ext}`);
                while (fs.existsSync(finalPath)) {
                    counter += 1;
                    finalPath = path.join(parsed.dir, `${parsed.name} (${counter})${parsed.ext}`);
                }
            }
        }

        if (dryRun) {
            appendLog(
                {
                    runId,
                    action: operation,
                    status: 'preview',
                    source: oldPath,
                    destination: finalPath,
                    message: `${path.basename(oldPath)} would be grouped.`
                },
                logFilePath
            );
            preview.push({ action: operation, source: oldPath, destination: finalPath, status: 'preview' });
            return true;
        }

        fs.renameSync(oldPath, finalPath);
        appendLog(
            {
                runId,
                action: operation,
                status: 'success',
                source: oldPath,
                destination: finalPath,
                message: `${path.basename(oldPath)} moved successfully.`
            },
            logFilePath
        );
        preview.push({ action: operation, source: oldPath, destination: finalPath, status: 'success' });
        return true;
    } catch (error) {
        appendLog(
            {
                runId,
                action: operation,
                status: 'error',
                source: oldPath,
                destination: newPath,
                message: error.message
            },
            logFilePath
        );
        preview.push({ action: operation, source: oldPath, destination: newPath, status: 'error', message: error.message });
        return false;
    }
}

function listEligibleFiles(dir, options = {}) {
    const entries = fs.readdirSync(dir);
    const files = [];

    entries.forEach(entry => {
        const fullPath = path.join(dir, entry);
        let stats;

        try {
            stats = fs.lstatSync(fullPath);
        } catch (error) {
            return;
        }

        if (!stats.isFile()) {
            return;
        }

        if (shouldSkipEntry(entry, options)) {
            return;
        }

        files.push(entry);
    });

    return files;
}

function groupBySeason(dir, options = {}) {
    const {
        logFilePath = defaultLogFilePath,
        logger = console.log,
        dryRun = false,
        runId = null,
        preview = []
    } = options;

    if (!fs.existsSync(dir)) {
        logger('Directory does not exist!');
        return { movedCount: 0, errorCount: 1, seriesCount: 0, preview };
    }

    const files = listEligibleFiles(dir, options);
    const seriesMap = {};

    files.forEach(file => {
        let season = null;
        let episode = null;
        let seriesName = extractSeriesName(file);
        const extension = path.extname(file);
        const parsed = extractSeasonEpisode(file);
        season = parsed.season;
        episode = parsed.episode;

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
        return { movedCount: 0, errorCount: 0, seriesCount: 0, preview };
    }

    let movedCount = 0;
    let errorCount = 0;

    seriesNames.forEach(seriesName => {
        const seriesDir = path.join(dir, seriesName);
        if (!dryRun && !fs.existsSync(seriesDir)) {
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
            if (!dryRun && !fs.existsSync(seasonDir)) {
                fs.mkdirSync(seasonDir, { recursive: true });
            }

            seriesMap[seriesName][season].forEach(fileInfo => {
                const oldPath = path.join(dir, fileInfo.original);
                const newPath = path.join(seasonDir, fileInfo.standardized);
                const moved = safeRenameForSeries(oldPath, newPath, 'group', logFilePath, { dryRun, runId, preview });
                if (moved) {
                    movedCount += 1;
                } else {
                    errorCount += 1;
                }
            });
        });
    });

    logger(`Series organization complete. Series: ${seriesNames.length}, moved: ${movedCount}, errors: ${errorCount}`);
    return { movedCount, errorCount, seriesCount: seriesNames.length, preview };
}

function organizeFilesByType(dir, options = {}) {
    const {
        logFilePath = defaultLogFilePath,
        moveToSystemFolders = false,
        systemPicturesPath = picturesPath,
        systemVideosPath = videosPath,
        dryRun = false,
        runId = null,
        preview = []
    } = options;

    const files = listEligibleFiles(dir, options);

    let processedCount = 0;
    let errorCount = 0;

    files.forEach(file => {
        const oldPath = path.join(dir, file);

        try {
            const ext = getFileExtension(file);
            const targetFolder = getTargetFolderByExtension(ext);
            let targetPath = null;

            if (videoExtensions.includes(ext) && moveToSystemFolders) {
                targetPath = systemVideosPath;
            }

            if (imageExtensions.includes(ext) && moveToSystemFolders) {
                targetPath = systemPicturesPath;
            }

            const finalTargetDir = targetPath || path.join(dir, targetFolder);

            if (!dryRun && !fs.existsSync(finalTargetDir)) {
                fs.mkdirSync(finalTargetDir, { recursive: true });
            }

            const newPath = path.join(finalTargetDir, file);
            if (safeRename(oldPath, newPath, 'move', logFilePath, { dryRun, runId, preview })) {
                processedCount += 1;
            } else {
                errorCount += 1;
            }
        } catch (error) {
            appendLog(
                {
                    runId,
                    action: 'move',
                    status: 'error',
                    source: oldPath,
                    destination: null,
                    message: error.message
                },
                logFilePath
            );
            preview.push({ action: 'move', source: oldPath, destination: null, status: 'error', message: error.message });
            errorCount += 1;
        }
    });

    return { processedCount, errorCount, preview };
}

function organizeByType(dir, inputOptions = {}) {
    const options = normalizeOptions(inputOptions);
    const {
        moveToSystemFolders = false,
        selectedVideosPath = videosPath,
        selectedPicturesPath = picturesPath,
        logFilePath = defaultLogFilePath,
        logger = console.log,
        dryRun = false
    } = options;

    if (!fs.existsSync(dir)) {
        throw new Error(`Directory does not exist: ${dir}`);
    }

    const runId = options.runId || generateRunId();
    const preview = [];

    appendLog(
        {
            runId,
            action: 'run-start',
            status: 'success',
            source: dir,
            destination: null,
            dryRun,
            message: dryRun ? 'Dry-run started.' : 'Organization started.'
        },
        logFilePath
    );

    const isDownloadsFolder = dir.toLowerCase().includes('downloads');
    const isRootVideosFolder = dir.toLowerCase() === selectedVideosPath.toLowerCase();
    const isSubfolderOfVideos = dir.toLowerCase().startsWith(selectedVideosPath.toLowerCase());
    let result;

    if (isSubfolderOfVideos && !isRootVideosFolder) {
        result = groupBySeason(dir, {
            ...options,
            logFilePath,
            logger,
            dryRun,
            runId,
            preview
        });
    } else if (isDownloadsFolder) {
        let totalProcessed = 0;
        let totalErrors = 0;

        if (moveToSystemFolders) {
            const files = listEligibleFiles(dir, options);

            files.forEach(file => {
                const oldPath = path.join(dir, file);
                const ext = getFileExtension(file);
                let systemPath = null;

                if (videoExtensions.includes(ext)) {
                    systemPath = selectedVideosPath;
                } else if (imageExtensions.includes(ext)) {
                    systemPath = selectedPicturesPath;
                }

                if (!systemPath) {
                    return;
                }

                if (!dryRun && !fs.existsSync(systemPath)) {
                    fs.mkdirSync(systemPath, { recursive: true });
                }

                const newPath = path.join(systemPath, file);
                if (safeRename(oldPath, newPath, 'move', logFilePath, { dryRun, runId, preview })) {
                    totalProcessed += 1;
                } else {
                    totalErrors += 1;
                }
            });
        }

        const byTypeResult = organizeFilesByType(dir, {
            ...options,
            logFilePath,
            moveToSystemFolders: false,
            dryRun,
            runId,
            preview
        });
        totalProcessed += byTypeResult.processedCount;
        totalErrors += byTypeResult.errorCount;

        result = {
            processedCount: totalProcessed,
            errorCount: totalErrors,
            preview
        };
    } else {
        result = organizeFilesByType(dir, {
            ...options,
            logFilePath,
            dryRun,
            runId,
            preview
        });
    }

    appendLog(
        {
            runId,
            action: 'run-end',
            status: 'success',
            source: dir,
            destination: null,
            dryRun,
            message: dryRun ? 'Dry-run completed.' : 'Organization completed.'
        },
        logFilePath
    );

    return {
        ...result,
        runId,
        dryRun,
        preview: result.preview || preview
    };
}

function findLatestRealRunId(logFilePath = defaultLogFilePath) {
    const logs = readLogLines(logFilePath);
    for (let index = logs.length - 1; index >= 0; index -= 1) {
        const entry = logs[index];
        if (entry.action === 'run-end' && entry.runId && !entry.dryRun) {
            return entry.runId;
        }
    }
    return null;
}

function findLatestLegacyBatch(logs) {
    const latestIndex = logs.length - 1;
    if (latestIndex < 0) {
        return [];
    }

    let cursor = latestIndex;
    while (
        cursor >= 0
        && !(
            !logs[cursor].runId
            && logs[cursor].status === 'success'
            && (logs[cursor].action === 'move' || logs[cursor].action === 'group')
            && logs[cursor].source
            && logs[cursor].destination
        )
    ) {
        cursor -= 1;
    }

    if (cursor < 0) {
        return [];
    }

    const anchorTime = new Date(logs[cursor].timestamp || 0).getTime();
    const maxGapMs = 2 * 60 * 1000;
    const batch = [];

    while (cursor >= 0) {
        const entry = logs[cursor];
        const isCandidate =
            !entry.runId
            && entry.status === 'success'
            && (entry.action === 'move' || entry.action === 'group')
            && entry.source
            && entry.destination;

        if (!isCandidate) {
            break;
        }

        const entryTime = new Date(entry.timestamp || 0).getTime();
        if (Number.isNaN(entryTime) || Math.abs(anchorTime - entryTime) > maxGapMs) {
            break;
        }

        batch.push(entry);
        cursor -= 1;
    }

    return batch.reverse();
}

function undoLastRun(options = {}) {
    const {
        logFilePath = defaultLogFilePath,
        logger = console.log,
        dryRun = false
    } = options;

    const logs = readLogLines(logFilePath);
    const targetRunId = options.runId || findLatestRealRunId(logFilePath);
    const undoRunId = generateRunId();
    const preview = [];

    const successfulOps = targetRunId
        ? logs.filter(entry =>
            entry.runId === targetRunId
            && entry.status === 'success'
            && (entry.action === 'move' || entry.action === 'group')
            && entry.source
            && entry.destination
        )
        : findLatestLegacyBatch(logs);

    if (!targetRunId && successfulOps.length === 0) {
        return {
            runId: null,
            undoRunId: null,
            undoneCount: 0,
            errorCount: 0,
            message: 'No previous run found to undo.',
            preview: []
        };
    }

    const effectiveTargetRunId = targetRunId || 'legacy-batch';

    if (successfulOps.length === 0) {
        return {
            runId: effectiveTargetRunId,
            undoRunId,
            undoneCount: 0,
            errorCount: 0,
            message: 'No successful move/group operations to undo.',
            preview
        };
    }

    appendLog(
        {
            runId: undoRunId,
            action: 'undo-start',
            status: 'success',
            source: null,
            destination: null,
            dryRun,
            targetRunId: effectiveTargetRunId,
            message: dryRun ? `Undo dry-run started for ${effectiveTargetRunId}.` : `Undo started for ${effectiveTargetRunId}.`
        },
        logFilePath
    );

    let undoneCount = 0;
    let errorCount = 0;

    for (let index = successfulOps.length - 1; index >= 0; index -= 1) {
        const item = successfulOps[index];

        if (!fs.existsSync(item.destination) && !dryRun) {
            appendLog(
                {
                    runId: undoRunId,
                    action: 'undo',
                    status: 'skipped',
                    source: item.destination,
                    destination: item.source,
                    message: 'Destination file no longer exists. Skipped undo for this item.'
                },
                logFilePath
            );
            preview.push({ action: 'undo', source: item.destination, destination: item.source, status: 'skipped' });
            errorCount += 1;
            continue;
        }

        const ok = safeRename(item.destination, item.source, 'undo', logFilePath, {
            dryRun,
            runId: undoRunId,
            preview
        });

        if (ok) {
            undoneCount += 1;
        } else {
            errorCount += 1;
        }
    }

    appendLog(
        {
            runId: undoRunId,
            action: 'undo-end',
            status: 'success',
            source: null,
            destination: null,
            dryRun,
            targetRunId: effectiveTargetRunId,
            message: dryRun ? 'Undo dry-run completed.' : 'Undo completed.'
        },
        logFilePath
    );

    logger(`Undo complete. undone: ${undoneCount}, errors: ${errorCount}`);

    return {
        runId: effectiveTargetRunId,
        undoRunId,
        undoneCount,
        errorCount,
        dryRun,
        preview
    };
}

function getLogs(logFilePath = defaultLogFilePath, limit = 200) {
    const parsed = readLogLines(logFilePath);
    return parsed.slice(Math.max(parsed.length - limit, 0)).reverse();
}

module.exports = {
    organizeByType,
    undoLastRun,
    getDefaultDirs,
    getLogs,
    defaultLogFilePath
};