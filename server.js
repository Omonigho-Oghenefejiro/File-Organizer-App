const express = require('express');
const path = require('path');
const {
    organizeByType,
    undoLastRun,
    getDefaultDirs,
    getLogs,
    defaultLogFilePath
} = require('./organizer');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/default-dirs', (req, res) => {
    res.json(getDefaultDirs());
});

app.get('/api/logs', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    res.json({ logs: getLogs(defaultLogFilePath, limit) });
});

app.post('/api/organize', (req, res) => {
    try {
        const targetDirectory = (req.body.directory || '').trim();
        const moveToSystemFolders = Boolean(req.body.moveToSystemFolders);
        const dryRun = Boolean(req.body.dryRun);
        const includeExtensions = req.body.includeExtensions || [];
        const excludeExtensions = req.body.excludeExtensions || [];
        const excludeNames = req.body.excludeNames || [];

        if (!targetDirectory) {
            return res.status(400).json({ error: 'Directory is required.' });
        }

        const resolvedDirectory = path.isAbsolute(targetDirectory)
            ? targetDirectory
            : path.resolve(targetDirectory);

        const result = organizeByType(resolvedDirectory, {
            moveToSystemFolders,
            dryRun,
            includeExtensions,
            excludeExtensions,
            excludeNames,
            logger: () => {}
        });

        return res.json({
            directory: resolvedDirectory,
            result
        });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.post('/api/undo-last-run', (req, res) => {
    try {
        const dryRun = Boolean(req.body.dryRun);
        const runId = (req.body.runId || '').trim() || null;

        const result = undoLastRun({
            dryRun,
            runId,
            logger: () => {}
        });

        return res.json(result);
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`File Organizer GUI running at http://localhost:${port}`);
});
