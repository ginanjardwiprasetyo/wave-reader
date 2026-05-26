import { DataParser } from './parser.js';
import { DataCleaner } from './cleaner.js';
import { WaveReader } from './reader.js';
import { ChartVisualizer } from './chart.js';
import { TableRenderer } from './table.js';
import { DataExporter } from './exporter.js';

class App {
    constructor() {
        this.allFilesData = [];
        this.windowSize = 5;
        this.activeFileIndex = 0;
        this.showAllFiles = false;
        this.showLabels = true;
        this.visibleChannels = null; // null = show all
        this.dropdownOpen = false;

        this.initializeUI();
        this.chartVisualizer = new ChartVisualizer('chartContainer');
        this.tableRenderer = new TableRenderer('tableContainer', this.onFileSelect.bind(this));
    }

    initializeUI() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const btnCsv = document.getElementById('btnExportCsv');
        const btnXlsx = document.getElementById('btnExportXlsx');
        const windowSizeInput = document.getElementById('windowSizeInput');
        const windowSizeValue = document.getElementById('windowSizeValue');
        const btnShowActiveOnly = document.getElementById('btnShowActiveOnly');
        const btnShowAll = document.getElementById('btnShowAll');
        const btnToggleLabels = document.getElementById('btnToggleLabels');
        const dropdownBtn = document.getElementById('dropdownBtn');

        // ── Drag & Drop ──
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
        dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('active'); });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('active');
            if (e.dataTransfer.files.length) this.processFiles(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                this.processFiles(e.target.files);
                e.target.value = ''; // Reset so same files can be re-selected
            }
        });

        // ── Export ──
        btnCsv.addEventListener('click', () => { if (this.allFilesData.length > 0) DataExporter.exportCSV(this.allFilesData); });
        btnXlsx.addEventListener('click', () => { if (this.allFilesData.length > 0) DataExporter.exportXLSX(this.allFilesData); });

        // ── Smoothing (visual only, doesn't affect reading results) ──
        windowSizeInput.addEventListener('input', (e) => {
            this.windowSize = parseInt(e.target.value);
            windowSizeValue.textContent = this.windowSize;
        });
        windowSizeInput.addEventListener('change', () => {
            if (this.allFilesData.length > 0) this.reprocessSmoothing();
        });

        // ── Custom Dropdown ──
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        document.addEventListener('click', () => {
            if (this.dropdownOpen) this.closeDropdown();
        });

        // ── Table Filter ──
        btnShowActiveOnly.addEventListener('click', () => {
            this.showAllFiles = false;
            btnShowActiveOnly.className = "px-4 py-1.5 rounded-lg font-semibold transition-all duration-200 text-xs pink-btn shadow-sm";
            btnShowAll.className = "px-4 py-1.5 rounded-lg font-medium transition-all duration-200 text-xs text-pink-600 hover:text-pink-800 cursor-pointer";
            this.tableRenderer.render(this.allFilesData, this.activeFileIndex, this.showAllFiles);
        });
        btnShowAll.addEventListener('click', () => {
            this.showAllFiles = true;
            btnShowAll.className = "px-4 py-1.5 rounded-lg font-semibold transition-all duration-200 text-xs pink-btn shadow-sm";
            btnShowActiveOnly.className = "px-4 py-1.5 rounded-lg font-medium transition-all duration-200 text-xs text-pink-600 hover:text-pink-800 cursor-pointer";
            this.tableRenderer.render(this.allFilesData, this.activeFileIndex, this.showAllFiles);
        });

        // ── Cycle Labels Toggle ──
        btnToggleLabels.addEventListener('click', () => {
            this.showLabels = !this.showLabels;
            btnToggleLabels.textContent = this.showLabels ? 'ON' : 'OFF';
            btnToggleLabels.className = this.showLabels
                ? 'px-4 py-1.5 rounded-xl text-xs font-semibold pink-btn shadow-sm'
                : 'px-4 py-1.5 rounded-xl text-xs font-semibold bg-pink-100 hover:bg-pink-200 text-pink-500 cursor-pointer transition-all shadow-sm';
            this.refreshChart();
        });
    }

    // ─── Custom Dropdown ────────────────────────────────────────
    toggleDropdown() { this.dropdownOpen ? this.closeDropdown() : this.openDropdown(); }

    openDropdown() {
        const list = document.getElementById('dropdownList');
        const arrow = document.getElementById('dropdownArrow');
        list.classList.remove('hidden');
        requestAnimationFrame(() => {
            list.classList.remove('scale-95', 'opacity-0');
            list.classList.add('scale-100', 'opacity-100');
        });
        arrow.classList.add('rotate-180');
        this.dropdownOpen = true;
    }

    closeDropdown() {
        const list = document.getElementById('dropdownList');
        const arrow = document.getElementById('dropdownArrow');
        list.classList.remove('scale-100', 'opacity-100');
        list.classList.add('scale-95', 'opacity-0');
        arrow.classList.remove('rotate-180');
        setTimeout(() => list.classList.add('hidden'), 200);
        this.dropdownOpen = false;
    }

    renderFileDropdown() {
        const list = document.getElementById('dropdownList');
        const label = document.getElementById('dropdownSelectedValue');
        list.innerHTML = '';

        if (this.allFilesData.length === 0) { label.textContent = 'No files selected'; return; }

        this.allFilesData.forEach((fileObj, idx) => {
            const isActive = idx === this.activeFileIndex;
            const item = document.createElement('div');
            item.className = `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${isActive ? 'bg-gradient-to-r from-pink-600 to-pink-700 text-white shadow-md' : 'text-pink-700 hover:bg-pink-50'}`;
            item.innerHTML = `
                <svg class="w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-pink-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <span class="truncate text-sm font-medium">${fileObj.fileData.filename}</span>`;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onFileSelect(idx);
                this.closeDropdown();
            });
            list.appendChild(item);
        });

        const active = this.allFilesData[this.activeFileIndex];
        label.textContent = active ? active.fileData.filename : 'No files selected';
    }

    // ─── Duplicate Toast ────────────────────────────────────────
    showDuplicateToast(filename) {
        const existing = document.getElementById('duplicateToast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'duplicateToast';
        toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-[60] flex items-center space-x-3 bg-pink-50 border border-pink-200 text-pink-800 px-6 py-4 rounded-2xl shadow-2xl transition-all duration-300 opacity-0 -translate-y-4';
        toast.innerHTML = `
            <div class="bg-pink-100 p-2 rounded-full flex-shrink-0">
                <svg class="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
            </div>
            <div>
                <p class="font-bold text-sm">Duplicate File Detected</p>
                <p class="text-xs mt-0.5"><strong>"${filename}"</strong> has already been uploaded. Skipping.</p>
            </div>
            <button class="ml-2 text-pink-500 hover:text-pink-700 p-1 rounded-lg hover:bg-pink-100 transition-colors" onclick="this.parentElement.remove()">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.classList.remove('opacity-0', '-translate-y-4'); toast.classList.add('opacity-100', 'translate-y-0'); });
        setTimeout(() => { if (toast.parentElement) { toast.classList.add('opacity-0', '-translate-y-4'); toast.classList.remove('opacity-100', 'translate-y-0'); setTimeout(() => toast.remove(), 300); } }, 5000);
    }

    // ─── File Processing ────────────────────────────────────────
    async processFiles(files) {
        const progressContainer = document.getElementById('progressContainer');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const dropZone = document.getElementById('dropZone');
        const resultsSection = document.getElementById('resultsSection');

        progressContainer.classList.remove('hidden');

        const validFiles = Array.from(files).filter(f => {
            const ext = f.name.split('.').pop().toLowerCase();
            return ['csv', 'xls', 'xlsx'].includes(ext);
        });

        const existingFilenames = new Set(this.allFilesData.map(f => f.fileData.filename));
        const startIndex = this.allFilesData.length;
        let addedCount = 0;

        for (let i = 0; i < validFiles.length; i++) {
            const file = validFiles[i];
            progressText.textContent = `Processing ${file.name} (${i + 1}/${validFiles.length})...`;
            progressBar.style.width = `${((i + 1) / validFiles.length) * 100}%`;

            if (existingFilenames.has(file.name)) {
                this.showDuplicateToast(file.name);
                continue;
            }

            try {
                const fileData = await DataParser.parseFile(file);
                // Reading runs on RAW data — completely independent of smoothing
                const reading = WaveReader.readAllChannels(fileData.channels);
                const cleaned = DataCleaner.cleanAllChannels(fileData.channels, this.windowSize);
                this.allFilesData.push({ fileData, cleaned, reading });
                existingFilenames.add(file.name);
                addedCount++;
            } catch (err) {
                console.error(`Error parsing ${file.name}:`, err);
                alert(`Error processing ${file.name}: ${err.message}`);
            }
        }

        if (addedCount > 0) this.activeFileIndex = startIndex;

        this.renderFileDropdown();
        if (this.allFilesData.length > 0) this.onFileSelect(this.activeFileIndex);

        progressText.textContent = `Done — ${addedCount} file(s) loaded.`;
        setTimeout(() => {
            progressContainer.classList.add('hidden');
            dropZone.classList.add('hidden');
            resultsSection.classList.remove('hidden');
        }, 1000);
    }

    // ─── Re-smooth only (when slider changes) ──────────────────
    reprocessSmoothing() {
        // Only re-clean for chart display. Reading results are untouched.
        this.allFilesData.forEach(fileObj => {
            fileObj.cleaned = DataCleaner.cleanAllChannels(fileObj.fileData.channels, this.windowSize);
        });
        this.refreshChart();
    }

    // ─── Channel Filter Buttons ─────────────────────────────────
    renderChannelFilters(headers) {
        const container = document.getElementById('channelFilterContainer');
        container.innerHTML = '';
        const colors = ['#DB2777', '#2563EB', '#CA8A04', '#16A34A', '#7C3AED', '#DC2626'];

        // "All" button
        const allBtn = document.createElement('button');
        const allActive = this.visibleChannels === null;
        allBtn.className = `px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 border ${allActive ? 'bg-pink-700 text-white border-pink-700 shadow-sm' : 'bg-white/70 text-pink-600 border-pink-200/50 hover:bg-pink-50'}`;
        allBtn.textContent = 'All';
        allBtn.addEventListener('click', () => {
            this.visibleChannels = null;
            this.renderChannelFilters(headers);
            this.refreshChart();
        });
        container.appendChild(allBtn);

        headers.forEach((header, idx) => {
            const btn = document.createElement('button');
            const color = colors[idx % colors.length];
            const isActive = this.visibleChannels !== null && this.visibleChannels.includes(idx);

            btn.className = 'px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 border';
            if (isActive) {
                btn.style.cssText = `background-color:${color};color:#fff;border-color:${color};box-shadow:0 2px 8px ${color}40;`;
            } else {
                btn.style.cssText = `background-color:rgba(255,255,255,0.7);color:${color};border-color:${color}40;`;
            }

            btn.textContent = header || `Ch${idx + 1}`;
            btn.addEventListener('click', () => {
                if (this.visibleChannels === null) {
                    this.visibleChannels = [idx];
                } else if (this.visibleChannels.includes(idx)) {
                    this.visibleChannels = this.visibleChannels.filter(i => i !== idx);
                    if (this.visibleChannels.length === 0) this.visibleChannels = null;
                } else {
                    this.visibleChannels.push(idx);
                    if (this.visibleChannels.length === headers.length) this.visibleChannels = null;
                }
                this.renderChannelFilters(headers);
                this.refreshChart();
            });
            container.appendChild(btn);
        });
    }

    // ─── Chart Refresh ──────────────────────────────────────────
    refreshChart() {
        const fileObj = this.allFilesData[this.activeFileIndex];
        if (!fileObj) return;
        const chartData = {
            filename: fileObj.fileData.filename,
            headers: fileObj.fileData.headers,
            channels: fileObj.cleaned
        };
        this.chartVisualizer.render(chartData, fileObj.reading, this.visibleChannels, this.showLabels);
    }

    // ─── File Selection ─────────────────────────────────────────
    onFileSelect(fileIndex) {
        this.activeFileIndex = fileIndex;
        this.visibleChannels = null;

        this.renderFileDropdown();

        const fileObj = this.allFilesData[fileIndex];
        if (fileObj) {
            this.renderChannelFilters(fileObj.fileData.headers);
            const chartData = {
                filename: fileObj.fileData.filename,
                headers: fileObj.fileData.headers,
                channels: fileObj.cleaned
            };
            this.chartVisualizer.render(chartData, fileObj.reading, this.visibleChannels, this.showLabels);
            this.tableRenderer.render(this.allFilesData, this.activeFileIndex, this.showAllFiles);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
