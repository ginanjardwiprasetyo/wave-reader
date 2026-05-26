export class TableRenderer {
    constructor(containerId, onRowClick) {
        this.container = document.getElementById(containerId);
        this.onRowClick = onRowClick;
    }

    render(allFilesData, activeFileIndex = 0, showAllFiles = false) {
        if (allFilesData.length === 0) {
            this.container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <svg class="w-12 h-12 text-pink-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p class="text-pink-400 text-sm font-medium">No files uploaded yet. Drag or browse files to start reading.</p>
                </div>`;
            return;
        }

        // Determine which files to render
        const filesToRender = showAllFiles 
            ? allFilesData.map((f, idx) => ({ ...f, originalIndex: idx }))
            : [ { ...allFilesData[activeFileIndex], originalIndex: activeFileIndex } ];

        let html = `
            <div class="overflow-x-auto">
            <table class="min-w-full text-left border-collapse">
                <thead>
                    <tr class="bg-pink-50/50 border-b border-pink-200/30">
                        <th class="px-6 py-4 text-xs font-bold text-pink-500 uppercase tracking-widest">File Name</th>
                        <th class="px-6 py-4 text-xs font-bold text-pink-500 uppercase tracking-widest">Channel</th>
                        <th class="px-6 py-4 text-right text-xs font-bold text-pink-600 uppercase tracking-widest">P1 (Peak)</th>
                        <th class="px-6 py-4 text-right text-xs font-bold text-amber-600 uppercase tracking-widest">V1 (Valley)</th>
                        <th class="px-6 py-4 text-right text-xs font-bold text-pink-600 uppercase tracking-widest">P2 (Peak)</th>
                        <th class="px-6 py-4 text-right text-xs font-bold text-amber-600 uppercase tracking-widest">V2 (Valley)</th>
                        <th class="px-6 py-4 text-right text-xs font-bold text-pink-600 uppercase tracking-widest">P3 (Peak)</th>
                        <th class="px-6 py-4 text-right text-xs font-bold text-amber-600 uppercase tracking-widest">V3 (Valley)</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-pink-100/50 bg-white/50">
        `;

        const colors = ['#DB2777', '#2563EB', '#CA8A04', '#16A34A', '#7C3AED', '#DC2626'];

        filesToRender.forEach((fileObj) => {
            const fileIdx = fileObj.originalIndex;
            const isFileActive = fileIdx === activeFileIndex;
            
            fileObj.reading.forEach((chReading, chIdx) => {
                const chName = fileObj.fileData.headers[chIdx] || `Ch${chIdx+1}`;
                const chColor = colors[chIdx % colors.length];
                
                const formatVal = (pt) => pt ? pt.value.toFixed(3) : '-';
                
                // Highlight row if it belongs to the active file (even in All Files Recap mode)
                const activeClass = (showAllFiles && isFileActive) ? 'table-row-active' : '';

                html += `
                    <tr class="table-row-hover ${activeClass} transition-colors duration-150" data-file-idx="${fileIdx}" style="border-left: 3px solid ${chColor}20;">
                        <td class="px-6 py-3.5 whitespace-nowrap text-sm font-semibold text-pink-800">${fileObj.fileData.filename}</td>
                        <td class="px-6 py-3.5 whitespace-nowrap text-sm font-medium">
                            <div class="flex items-center gap-2">
                                <span class="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${chColor};"></span>
                                <span style="color:${chColor};">${chName}</span>
                            </div>
                        </td>
                        <td class="px-6 py-3.5 whitespace-nowrap text-sm text-right font-bold text-pink-600">${formatVal(chReading.peak1)}</td>
                        <td class="px-6 py-3.5 whitespace-nowrap text-sm text-right font-bold text-amber-600">${formatVal(chReading.valley1)}</td>
                        <td class="px-6 py-3.5 whitespace-nowrap text-sm text-right font-bold text-pink-600">${formatVal(chReading.peak2)}</td>
                        <td class="px-6 py-3.5 whitespace-nowrap text-sm text-right font-bold text-amber-600">${formatVal(chReading.valley2)}</td>
                        <td class="px-6 py-3.5 whitespace-nowrap text-sm text-right font-bold text-pink-600">${formatVal(chReading.peak3)}</td>
                        <td class="px-6 py-3.5 whitespace-nowrap text-sm text-right font-bold text-amber-600">${formatVal(chReading.valley3)}</td>
                    </tr>
                `;
            });
        });

        html += `</tbody></table></div>`;
        this.container.innerHTML = html;

        // Hook click handlers to let rows change selected file
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
}
