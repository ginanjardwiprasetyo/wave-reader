export class DataParser {
    static async parseFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        
        if (ext === 'csv') {
            return await this.parseCSV(file);
        } else if (ext === 'xls' || ext === 'xlsx') {
            return await this.parseExcel(file);
        } else {
            throw new Error('Unsupported file format: ' + file.name);
        }
    }

    static parseCSV(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                worker: true,
                skipEmptyLines: true,
                complete: (results) => {
                    try {
                        const parsedData = this.extractWTM903Data(results.data, file.name);
                        resolve(parsedData);
                    } catch (error) {
                        reject(error);
                    }
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }

    static parseExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                    
                    const parsedData = this.extractWTM903Data(rows, file.name);
                    resolve(parsedData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    }

    static extractWTM903Data(rows, filename) {
        // WTM903 format:
        // Row 0: Title
        // Row 1: Timestamp
        // Row 2: Separator
        // Row 3: Headers (e.g. Ch1, Ch2...)
        // Row 4: Units (e.g. mm)
        // Row 5+: Data
        
        if (rows.length < 6) {
            throw new Error(`File ${filename} does not contain enough rows to be a valid WTM903 format.`);
        }

        const timestampStr = rows[1] ? (rows[1][0] || 'Unknown Time') : 'Unknown Time';
        
        const headerRow = rows[3];
        
        let channelColIndices = [];
        let channelNames = [];
        
        for (let i = 0; i < headerRow.length; i++) {
            const val = String(headerRow[i]).trim();
            if (val.toLowerCase().startsWith('ch')) {
                channelColIndices.push(i);
                channelNames.push(val);
            }
        }
        
        if (channelColIndices.length === 0) {
            // fallback
            for(let i=1; i<=6 && i<headerRow.length; i++) {
                channelColIndices.push(i);
                channelNames.push(`Ch${i}`);
            }
        }

        const numChannels = channelColIndices.length;
        const channelsData = Array.from({ length: numChannels }, () => []);
        
        for (let i = 5; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            
            // Check if there is actual data in the row
            let isEmpty = true;
            for (let c = 0; c < numChannels; c++) {
                if (row[channelColIndices[c]] !== undefined && row[channelColIndices[c]] !== '') {
                    isEmpty = false;
                    break;
                }
            }
            if (isEmpty) continue;
            
            for (let c = 0; c < numChannels; c++) {
                const colIdx = channelColIndices[c];
                const val = parseFloat(row[colIdx]);
                channelsData[c].push(isNaN(val) ? 0 : val); // Provide 0 or interpolation instead of NaN to avoid issues
            }
        }

        return {
            filename,
            timestamp: timestampStr,
            headers: channelNames,
            channels: channelsData
        };
    }
}
