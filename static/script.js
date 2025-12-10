function openTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show specific tab content
    document.getElementById(tabName).classList.add('active');

    // Add active class to clicked button
    event.currentTarget.classList.add('active');
}

// File Upload Logic
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('filename');
const analyzeFileBtn = document.getElementById('analyze-file-btn');
const removeFileBtn = document.getElementById('remove-file-btn');

removeFileBtn.addEventListener('click', () => {
    selectedFile = null;
    fileName.textContent = '';
    dropZone.classList.remove('hidden');
    fileInfo.classList.add('hidden');
});

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

let selectedFile = null;

function handleFile(file) {
    selectedFile = file;
    fileName.textContent = file.name;
    dropZone.classList.add('hidden');
    fileInfo.classList.remove('hidden');
}

// Analysis Logic
const analyzeTextBtn = document.getElementById('analyze-text-btn');
const resultsDiv = document.getElementById('results');
const loadingDiv = document.getElementById('loading');
const resultContent = document.getElementById('result-content');
const detectionResult = document.getElementById('detection-result');
const transcriptionCard = document.getElementById('transcription-card');
const transcriptionText = document.getElementById('transcription-text');

analyzeTextBtn.addEventListener('click', async () => {
    document.getElementById('res-language').textContent = "-";
    document.getElementById('res-confidence').textContent = "-";
    document.getElementById('res-translation').textContent = "-";
    document.getElementById('res-time').textContent = "-";
    const text = document.getElementById('text-input').value;
    if (!text.trim()) return alert("Please enter some text");

    showLoading();

    try {
        const response = await fetch('/analyze_text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const data = await response.json();
        console.log(data.result);
        displayResult(data.result, data.execution_time);
        transcriptionCard.classList.add('hidden');
    } catch (error) {
        alert("Error analyzing text");
        console.error(error);
    } finally {
        hideLoading();
    }
});

analyzeFileBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    showLoading();

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
        const response = await fetch('/analyze_file', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        displayResult(data.analysis, data.execution_time);
        transcriptionText.textContent = data.transcription;
        transcriptionCard.classList.remove('hidden');

    } catch (error) {
        alert("Error analyzing file: " + error.message);
        console.error(error);
    } finally {
        hideLoading();
    }
});

function showLoading() {
    resultsDiv.classList.remove('hidden');
    loadingDiv.classList.remove('hidden');
    resultContent.classList.add('hidden');
}

function hideLoading() {
    loadingDiv.classList.add('hidden');
    resultContent.classList.remove('hidden');
}

function displayResult(resultData, executionTime) {
    try {
        let jsonObj;
        if (typeof resultData === 'string') {
            try {
                // Try parsing directly
                jsonObj = JSON.parse(resultData);
            } catch (e) {
                console.warn("Direct JSON parse failed, attempting to sanitize...", e);
                // If failed, likely due to unescaped control chars. Escape them.
                const sanitized = resultData
                    .replace(/[\n\r]/g, "\\n") // Escape newlines
                    .replace(/\t/g, "\\t");
                jsonObj = JSON.parse(sanitized);
            }
        } else {
            jsonObj = resultData;
        }

        // Populate Structured Data
        document.getElementById('res-language').textContent = jsonObj.language || 'Unknown';
        document.getElementById('res-confidence').textContent = jsonObj.confidence ? (jsonObj.confidence * 100).toFixed(1) + '%' : '-';
        document.getElementById('res-translation').textContent = jsonObj.translation || jsonObj.summary || '-';

        // Time - check if executionTime is provided, otherwise look in jsonObj
        const tim = executionTime || jsonObj.execution_time || '-';
        document.getElementById('res-time').textContent = tim + (tim !== '-' ? 's' : '');

    } catch (e) {
        console.error("Error parsing result", e);
        document.getElementById('res-translation').textContent = "Error parsing result. Raw: " + (typeof resultData === 'string' ? resultData : JSON.stringify(resultData));
    }
}
