export class DataExporter {
    static generateExportData(allFilesData) {
        const rows = [];
        
        rows.push(['File Name', 'Timestamp', 'Channel', 'Peak 1', 'Valley 1', 'Peak 2', 'Valley 2', 'Peak 3', 'Valley 3']);
        
        allFilesData.forEach(fileObj => {
            fileObj.reading.forEach((chReading, chIdx) => {
                const chName = fileObj.fileData.headers[chIdx] || `Ch${chIdx+1}`;
                const formatVal = (pt) => pt ? pt.value : '';
                
                rows.push([
                    fileObj.fileData.filename,
                    fileObj.fileData.timestamp,
                    chName,
                    formatVal(chReading.peak1),
                    formatVal(chReading.valley1),
                    formatVal(chReading.peak2),
                    formatVal(chReading.valley2),
                    formatVal(chReading.peak3),
                    formatVal(chReading.valley3)
                ]);
            });
        });
        
        return rows;
    }

    static exportCSV(allFilesData) {
        const data = this.generateExportData(allFilesData);
        const csv = Papa.unparse(data);
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'wave_recap.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    static exportXLSX(allFilesData) {
        const data = this.generateExportData(allFilesData);
        
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Recap");
        
        XLSX.writeFile(wb, "wave_recap.xlsx");
    }
}
