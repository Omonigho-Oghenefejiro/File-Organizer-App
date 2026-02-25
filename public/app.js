const directoryInput = document.getElementById('directory');
const moveToSystemFoldersInput = document.getElementById('moveToSystemFolders');
const moveMediaInput = document.getElementById('moveMedia');
const dryRunInput = document.getElementById('dryRun');
const includeExtensionsInput = document.getElementById('includeExtensions');
const excludeExtensionsInput = document.getElementById('excludeExtensions');
const excludeNamesInput = document.getElementById('excludeNames');
const organizeBtn = document.getElementById('organizeBtn');
const checkLogsBtn = document.getElementById('checkLogsBtn');
const undoBtn = document.getElementById('undoBtn');
const resultBox = document.getElementById('result');
const logsBody = document.getElementById('logsBody');
const presetDir = document.getElementById('presetDir');
const applyPresetBtn = document.getElementById('applyPreset');
const logsSection = document.getElementById('logsSection');

function formatDateTime(iso) {
    if (!iso) return '-';
    const date = new Date(iso);
    return date.toLocaleString();
}

function renderLogs(logs) {
    logsBody.innerHTML = '';

    if (!logs.length) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" style="text-align: center; color: var(--text-tertiary);">No logs yet.</td>';
        logsBody.appendChild(row);
        return;
    }

    logs.forEach(log => {
        const row = document.createElement('tr');
        const status = (log.status || '').toLowerCase();
        const statusClass = `status-${status}`;

        row.innerHTML = `
            <td>${formatDateTime(log.timestamp)}</td>
            <td><span class="${statusClass}">${log.status || '-'}</span></td>
            <td>${log.action || '-'}</td>
            <td>${log.source || '-'}</td>
            <td>${log.destination || '-'}</td>
            <td>${log.message || '-'}</td>
        `;

        logsBody.appendChild(row);
    });
}

async function loadDefaultDirs() {
    try {
        const response = await fetch('/api/default-dirs');
        const data = await response.json();

        Object.entries(data).forEach(([key, value]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = `${key}: ${value}`;
            presetDir.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load default directories:', error);
    }
}

async function refreshLogs() {
    try {
        const response = await fetch('/api/logs?limit=300');
        const data = await response.json();
        renderLogs(data.logs || []);
    } catch (error) {
        console.error('Failed to refresh logs:', error);
    }
}

async function checkLogs() {
    await refreshLogs();
    resultBox.textContent = `✓ Logs updated at ${new Date().toLocaleString()}`;
    if (logsSection) {
        logsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

async function organizeDirectory() {
    const directory = directoryInput.value.trim();

    if (!directory) {
        resultBox.textContent = '⚠ Please enter a directory path.';
        return;
    }

    organizeBtn.disabled = true;
    resultBox.textContent = '⏳ Running organizer...';

    try {
        const moveToSystemFolders = Boolean(
            (moveToSystemFoldersInput && moveToSystemFoldersInput.checked) ||
            (moveMediaInput && moveMediaInput.checked)
        );
        const dryRun = Boolean(dryRunInput && dryRunInput.checked);

        const parseList = value => (value || '')
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);

        const includeExtensions = parseList(includeExtensionsInput && includeExtensionsInput.value);
        const excludeExtensions = parseList(excludeExtensionsInput && excludeExtensionsInput.value);
        const excludeNames = parseList(excludeNamesInput && excludeNamesInput.value);

        const response = await fetch('/api/organize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                directory,
                moveToSystemFolders,
                dryRun,
                includeExtensions,
                excludeExtensions,
                excludeNames
            })
        });

        const data = await response.json();

        if (!response.ok) {
            resultBox.textContent = `✗ Error: ${data.error || 'Request failed.'}`;
            return;
        }

        const modeText = data.result && data.result.dryRun ? 'Preview complete' : 'Organization complete';
        const previewCount = data.result && Array.isArray(data.result.preview) ? data.result.preview.length : 0;
        resultBox.textContent = `✓ ${modeText}\nDirectory: ${data.directory}\nRun ID: ${data.result.runId || '-'}\nActions: ${previewCount}`;
        await refreshLogs();
    } catch (error) {
        resultBox.textContent = `✗ Error: ${error.message}`;
    } finally {
        organizeBtn.disabled = false;
    }
}

async function undoLastRunAction() {
    undoBtn.disabled = true;
    resultBox.textContent = '⏳ Running undo...';

    try {
        const dryRun = Boolean(dryRunInput && dryRunInput.checked);
        const response = await fetch('/api/undo-last-run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dryRun })
        });

        const data = await response.json();
        if (!response.ok) {
            resultBox.textContent = `✗ Error: ${data.error || 'Undo failed.'}`;
            return;
        }

        resultBox.textContent = `✓ Undo ${data.dryRun ? 'preview' : 'complete'}\nTarget Run: ${data.runId || '-'}\nUndone: ${data.undoneCount || 0}\nErrors: ${data.errorCount || 0}`;
        await refreshLogs();
    } catch (error) {
        resultBox.textContent = `✗ Error: ${error.message}`;
    } finally {
        undoBtn.disabled = false;
    }
}

applyPresetBtn.addEventListener('click', () => {
    if (presetDir.value) {
        directoryInput.value = presetDir.value;
        directoryInput.focus();
    }
});

organizeBtn.addEventListener('click', organizeDirectory);
checkLogsBtn.addEventListener('click', checkLogs);
undoBtn.addEventListener('click', undoLastRunAction);

(async function init() {
    await loadDefaultDirs();
    await refreshLogs();
    setInterval(refreshLogs, 10000);
})();
