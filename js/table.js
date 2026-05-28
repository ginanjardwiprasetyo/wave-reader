export class TableRenderer {
    constructor(containerId, onRowClick) {
        this.container = document.getElementById(containerId);
        this.onRowClick = onRowClick;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.currentPage = 1;
    }

    getFileBadge(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (ext === 'csv') return '<span class="file-badge csv">CSV</span>';
        if (ext === 'xlsx') return '<span class="file-badge xlsx">XLSX</span>';
        if (ext === 'xls') return '<span class="file-badge xls">XLS</span>';
        return '';
    }

    render(allFilesData, activeFileIndex = 0, showAllFiles = false) {
        if (allFilesData.length === 0) {
            this.container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <svg class="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--color-text-muted);">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p class="text-sm font-medium" style="color: var(--color-text-muted);">No files uploaded yet. Drag or browse files to start reading.</p>
                </div>`;
            return;
        }

        const enablePagination = showAllFiles && allFilesData.length > 1;
        const totalFiles = allFilesData.length;
        if (this.currentPage > totalFiles) this.currentPage = 1;

        const filesToRender = showAllFiles
            ? (enablePagination
                ? [{ ...allFilesData[this.currentPage - 1], originalIndex: this.currentPage - 1 }]
                : allFilesData.map((f, idx) => ({ ...f, originalIndex: idx })))
            : [{ ...allFilesData[activeFileIndex], originalIndex: activeFileIndex }];

        const colors = ['#DB2777', '#2563EB', '#CA8A04', '#16A34A', '#7C3AED', '#DC2626'];
        const flatRows = [];

        filesToRender.forEach((fileObj) => {
            const fileIdx = fileObj.originalIndex;
            fileObj.reading.forEach((chReading, chIdx) => {
                const chName = fileObj.fileData.headers[chIdx] || `Ch${chIdx+1}`;
                const chColor = colors[chIdx % colors.length];
                const formatVal = (pt) => pt ? pt.value : null;

                flatRows.push({
                    fileIdx,
                    filename: fileObj.fileData.filename,
                    chName,
                    chColor,
                    chIdx,
                    peak1: formatVal(chReading.peak1),
                    valley1: formatVal(chReading.valley1),
                    peak2: formatVal(chReading.peak2),
                    valley2: formatVal(chReading.valley2),
                    peak3: formatVal(chReading.peak3),
                    valley3: formatVal(chReading.valley3),
                    isFileActive: fileIdx === activeFileIndex
                });
            });
        });

        if (this.sortColumn) {
            flatRows.sort((a, b) => {
                let valA = a[this.sortColumn];
                let valB = b[this.sortColumn];
                if (typeof valA === 'string') {
                    valA = valA.toLowerCase();
                    valB = (valB || '').toLowerCase();
                } else {
                    valA = valA ?? -Infinity;
                    valB = valB ?? -Infinity;
                }
                if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
                if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        const pageRows = flatRows;

        const sortIcon = (col) => {
            if (this.sortColumn !== col) return '<span class="sort-indicator">&#8645;</span>';
            return `<span class="sort-indicator active">${this.sortDirection === 'asc' ? '&#8593;' : '&#8595;'}</span>`;
        };

        let html = `
            <div class="overflow-x-auto">
            <table class="min-w-full text-left border-collapse">
                <thead>
                    <tr style="background: var(--color-table-header-bg); border-color: var(--color-border);">
                        <th class="sort-header px-6 py-4 text-xs font-bold uppercase tracking-widest" style="color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);" data-sort="filename">File ${sortIcon('filename')}</th>
                        <th class="sort-header px-6 py-4 text-xs font-bold uppercase tracking-widest" style="color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);" data-sort="chName">Channel ${sortIcon('chName')}</th>
                        <th class="sort-header px-6 py-4 text-center text-xs font-bold uppercase tracking-widest" style="color: #DB2777; border-bottom: 1px solid var(--color-border);" data-sort="peak1">P1 (Peak) ${sortIcon('peak1')}</th>
                        <th class="sort-header px-6 py-4 text-center text-xs font-bold uppercase tracking-widest" style="color: #CA8A04; border-bottom: 1px solid var(--color-border);" data-sort="valley1">V1 (Valley) ${sortIcon('valley1')}</th>
                        <th class="sort-header px-6 py-4 text-center text-xs font-bold uppercase tracking-widest" style="color: #DB2777; border-bottom: 1px solid var(--color-border);" data-sort="peak2">P2 (Peak) ${sortIcon('peak2')}</th>
                        <th class="sort-header px-6 py-4 text-center text-xs font-bold uppercase tracking-widest" style="color: #CA8A04; border-bottom: 1px solid var(--color-border);" data-sort="valley2">V2 (Valley) ${sortIcon('valley2')}</th>
                        <th class="sort-header px-6 py-4 text-center text-xs font-bold uppercase tracking-widest" style="color: #DB2777; border-bottom: 1px solid var(--color-border);" data-sort="peak3">P3 (Peak) ${sortIcon('peak3')}</th>
                        <th class="sort-header px-6 py-4 text-center text-xs font-bold uppercase tracking-widest" style="color: #CA8A04; border-bottom: 1px solid var(--color-border);" data-sort="valley3">V3 (Valley) ${sortIcon('valley3')}</th>
                    </tr>
                </thead>
                <tbody class="divide-y" style="border-color: rgba(219,39,119,0.06); border-bottom-color: rgba(219,39,119,0.06); background: var(--color-table-bg);">
        `;

        pageRows.forEach((row, rowIndex) => {
            const activeClass = (showAllFiles && row.isFileActive) ? 'table-row-active' : '';
            const zebraClass = rowIndex % 2 === 0 ? 'table-row-even' : 'table-row-odd';
            const formatDisplay = (val) => val !== null ? val.toFixed(2) : '-';

            html += `
                <tr class="table-row-hover ${zebraClass} ${activeClass} transition-colors duration-150" data-file-idx="${row.fileIdx}" style="border-left: 3px solid ${row.chColor}20;">
                    <td class="px-6 py-3.5 whitespace-nowrap text-sm font-semibold" style="color: var(--color-text-main);">
                        <span class="truncate max-w-[140px] block">${row.filename}</span>
                    </td>
                    <td class="px-6 py-3.5 whitespace-nowrap text-sm font-medium">
                        <div class="flex items-center gap-2">
                            <span class="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${row.chColor};"></span>
                            <span style="color:${row.chColor};">${row.chName}</span>
                        </div>
                    </td>
                    <td class="px-6 py-3.5 whitespace-nowrap text-sm text-center font-bold mono" style="color: #DB2777;">${formatDisplay(row.peak1)}</td>
                    <td class="px-6 py-3.5 whitespace-nowrap text-sm text-center font-bold mono" style="color: #CA8A04;">${formatDisplay(row.valley1)}</td>
                    <td class="px-6 py-3.5 whitespace-nowrap text-sm text-center font-bold mono" style="color: #DB2777;">${formatDisplay(row.peak2)}</td>
                    <td class="px-6 py-3.5 whitespace-nowrap text-sm text-center font-bold mono" style="color: #CA8A04;">${formatDisplay(row.valley2)}</td>
                    <td class="px-6 py-3.5 whitespace-nowrap text-sm text-center font-bold mono" style="color: #DB2777;">${formatDisplay(row.peak3)}</td>
                    <td class="px-6 py-3.5 whitespace-nowrap text-sm text-center font-bold mono" style="color: #CA8A04;">${formatDisplay(row.valley3)}</td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;

        if (!enablePagination) {
            const currentName = flatRows.length > 0 ? flatRows[0].filename : '';
            html += `<div class="flex items-center px-6" style="height:52px; color: var(--color-text-muted);">
                <span class="text-xs font-medium">${currentName ? `Showing: ${currentName}` : ''}</span>
            </div>`;
        }

        if (enablePagination) {
            html += `
                <div class="flex items-center justify-between px-6 py-3 border-t" style="border-color: var(--color-border); background: var(--color-table-header-bg);">
                    <span class="text-xs font-medium" style="color: var(--color-text-muted);">File ${this.currentPage} of ${totalFiles}</span>
                    <div class="flex items-center gap-1.5">
                        <button class="page-btn px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${this.currentPage <= 1 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-pink-100'}" style="color: var(--color-text-body);" data-page="prev" ${this.currentPage <= 1 ? 'disabled' : ''}>
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                        </button>
                        ${this.buildPageNumbers(this.currentPage, totalFiles)}
                        <button class="page-btn px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${this.currentPage >= totalFiles ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-pink-100'}" style="color: var(--color-text-body);" data-page="next" ${this.currentPage >= totalFiles ? 'disabled' : ''}>
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                        </button>
                    </div>
                </div>`;
        }

        this.container.innerHTML = html;

        this.container.querySelectorAll('.sort-header').forEach((th) => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this.sortColumn === col) {
                    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortColumn = col;
                    this.sortDirection = 'asc';
                }
                this.currentPage = 1;
                this.render(allFilesData, activeFileIndex, showAllFiles);
            });
        });

        if (enablePagination) {
            this.container.querySelectorAll('.page-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    if (btn.disabled) return;
                    const page = btn.dataset.page;
                    if (page === 'prev') {
                        this.currentPage = Math.max(1, this.currentPage - 1);
                    } else if (page === 'next') {
                        this.currentPage = Math.min(totalFiles, this.currentPage + 1);
                    } else {
                        this.currentPage = parseInt(page);
                    }
                    this.render(allFilesData, activeFileIndex, showAllFiles);
                });
            });
        }

        const rows = this.container.querySelectorAll('tbody tr');
        rows.forEach(row => {
            row.addEventListener('click', () => {
                const clickedIdx = parseInt(row.getAttribute('data-file-idx'));
                if (this.onRowClick) {
                    this.onRowClick(clickedIdx);
                }
            });
        });
    }

    buildPageNumbers(current, total) {
        if (total <= 7) {
            return Array.from({ length: total }, (_, i) =>
                `<button class="page-btn px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer ${i + 1 === current ? 'pink-btn shadow-sm' : 'hover:bg-pink-100'}" style="color: ${i + 1 === current ? '#fff' : 'var(--color-text-body)'};" data-page="${i + 1}">${i + 1}</button>`
            ).join('');
        }
        let pages = '';
        if (current <= 4) {
            for (let i = 1; i <= 5; i++) {
                pages += `<button class="page-btn px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer ${i === current ? 'pink-btn shadow-sm' : 'hover:bg-pink-100'}" style="color: ${i === current ? '#fff' : 'var(--color-text-body)'};" data-page="${i}">${i}</button>`;
            }
            pages += `<span class="px-1.5 text-xs" style="color: var(--color-text-muted);">...</span>`;
            pages += `<button class="page-btn px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer hover:bg-pink-100" style="color: var(--color-text-body);" data-page="${total}">${total}</button>`;
        } else if (current >= total - 3) {
            pages += `<button class="page-btn px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer hover:bg-pink-100" style="color: var(--color-text-body);" data-page="1">1</button>`;
            pages += `<span class="px-1.5 text-xs" style="color: var(--color-text-muted);">...</span>`;
            for (let i = total - 4; i <= total; i++) {
                pages += `<button class="page-btn px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer ${i === current ? 'pink-btn shadow-sm' : 'hover:bg-pink-100'}" style="color: ${i === current ? '#fff' : 'var(--color-text-body)'};" data-page="${i}">${i}</button>`;
            }
        } else {
            pages += `<button class="page-btn px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer hover:bg-pink-100" style="color: var(--color-text-body);" data-page="1">1</button>`;
            pages += `<span class="px-1.5 text-xs" style="color: var(--color-text-muted);">...</span>`;
            for (let i = current - 1; i <= current + 1; i++) {
                pages += `<button class="page-btn px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer ${i === current ? 'pink-btn shadow-sm' : 'hover:bg-pink-100'}" style="color: ${i === current ? '#fff' : 'var(--color-text-body)'};" data-page="${i}">${i}</button>`;
            }
            pages += `<span class="px-1.5 text-xs" style="color: var(--color-text-muted);">...</span>`;
            pages += `<button class="page-btn px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer hover:bg-pink-100" style="color: var(--color-text-body);" data-page="${total}">${total}</button>`;
        }
        return pages;
    }
}