export class DataCleaner {
    // Moving median filter with a configurable window size (default 5)
    static cleanChannel(data, windowSize = 5) {
        if (data.length < windowSize) return [...data];

        const cleaned = new Array(data.length);
        const halfWindow = Math.floor(windowSize / 2);

        for (let i = 0; i < data.length; i++) {
            // Edge cases: keep original values for the edges where we can't form a full window
            if (i < halfWindow || i >= data.length - halfWindow) {
                cleaned[i] = data[i];
                continue;
            }

            // Extract window
            const windowData = data.slice(i - halfWindow, i + halfWindow + 1);
            
            // Calculate median
            const sorted = [...windowData].sort((a, b) => a - b);
            const median = sorted[Math.floor(windowSize / 2)];
            
            cleaned[i] = median;
        }

        return cleaned;
    }

    static cleanAllChannels(channels, windowSize = 5) {
        return channels.map(chData => this.cleanChannel(chData, windowSize));
    }
}
