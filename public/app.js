const directoryInput = document.getElementById('directory');
const moveMediaInput = document.getElementById('moveMedia');
const organizeBtn = document.getElementById('organizeBtn');
const checkLogsBtn = document.getElementById('checkLogsBtn');
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
        row.innerHTML = '<td colspan="6">No logs yet.</td>';
        logsBody.appendChild(row);
        return;
    }

    logs.forEach(log => {
        const row = document.createElement('tr');
        const statusClass = `status-${(log.status || '').toLowerCase()}`;

        row.innerHTML = `
            <td>${formatDateTime(log.timestamp)}</td>
            <td class="${statusClass}">${log.status || '-'}</td>
            <td>${log.action || '-'}</td>
            <td>${log.source || '-'}</td>
            <td>${log.destination || '-'}</td>
            <td>${log.message || '-'}</td>
        `;

        logsBody.appendChild(row);
    });
}

async function loadDefaultDirs() {
    const response = await fetch('/api/default-dirs');
    const data = await response.json();

    Object.entries(data).forEach(([key, value]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = `${key}: ${value}`;
        presetDir.appendChild(option);
    });
}

async function refreshLogs() {
    const response = await fetch('/api/logs?limit=300');
    const data = await response.json();
    renderLogs(data.logs || []);
}

async function checkLogs() {
    await refreshLogs();
    resultBox.textContent = `Logs updated at ${new Date().toLocaleString()}`;
    if (logsSection) {
        logsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

async function organizeDirectory() {
    const directory = directoryInput.value.trim();

    if (!directory) {
        resultBox.textContent = 'Please enter a directory.';
        return;
    }

    organizeBtn.disabled = true;
    resultBox.textContent = 'Running organizer...';

    try {
        const response = await fetch('/api/organize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                directory,
                moveMedia: moveMediaInput.checked
            })
        });

        const data = await response.json();

        if (!response.ok) {
            resultBox.textContent = `Error: ${data.error || 'Request failed.'}`;
            return;
        }

        resultBox.textContent = `Completed for: ${data.directory}\nResult: ${JSON.stringify(data.result)}`;
        await refreshLogs();
    } catch (error) {
        resultBox.textContent = `Error: ${error.message}`;
    } finally {
        organizeBtn.disabled = false;
    }
}

applyPresetBtn.addEventListener('click', () => {
    if (presetDir.value) {
        directoryInput.value = presetDir.value;
    }
});

organizeBtn.addEventListener('click', organizeDirectory);
checkLogsBtn.addEventListener('click', checkLogs);

(async function init() {
    await loadDefaultDirs();
    await refreshLogs();
    setInterval(refreshLogs, 10000);
})();
