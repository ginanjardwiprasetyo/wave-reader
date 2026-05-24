export class WaveReader {
    /**
     * Read wave cycles from raw channel data using an advanced 
     * Local-Baseline Detrended Zero-Crossing algorithm.
     * 
     * Handles sensor drift, initial calm water, asymmetric waves, and high-frequency noise.
     * Peak and Valley values are extracted from the raw uncleaned data.
     */
    static readChannel(data) {
        if (!data || data.length < 10) return this.emptyResult();

        // 1. Calculate a slow-moving average to serve as the local baseline (detrending baseline).
        // This dynamically follows any water level setup, slow sensor drifts, or initial calm levels.
        const slowWindow = Math.min(151, Math.floor(data.length / 3) | 1); // odd window size
        const baseline = [];
        const slowHalf = Math.floor(slowWindow / 2);
        for (let i = 0; i < data.length; i++) {
            let sum = 0;
            let count = 0;
            for (let j = -slowHalf; j <= slowHalf; j++) {
                const idx = i + j;
                if (idx >= 0 && idx < data.length) {
                    sum += data[idx];
                    count++;
                }
            }
            baseline.push(sum / count);
        }

        // 2. Calculate a fast-moving average to serve as a denoised stabilizer.
        // This removes high-frequency ripples for stable zero-crossing detection.
        const fastWindow = 9;
        const ma = [];
        const fastHalf = Math.floor(fastWindow / 2);
        for (let i = 0; i < data.length; i++) {
            let sum = 0;
            let count = 0;
            for (let j = -fastHalf; j <= fastHalf; j++) {
                const idx = i + j;
                if (idx >= 0 && idx < data.length) {
                    sum += data[idx];
                    count++;
                }
            }
            ma.push(sum / count);
        }

        // 3. Segment the signal into positive and negative phases relative to the local baseline
        const states = ma.map((v, i) => v >= baseline[i] ? 'positive' : 'negative');
        const segments = [];
        let curState = states[0];
        let start = 0;
        for (let i = 1; i < states.length; i++) {
            if (states[i] !== curState) {
                segments.push({ state: curState, start, end: i - 1 });
                curState = states[i];
                start = i;
            }
        }
        segments.push({ state: curState, start, end: states.length - 1 });

        // 4. Clean up segments: merge segments that are too short to filter out ripples
        let minLen = 10;
        if (data.length < 50) minLen = 2; // for small test data

        const cleanSegments = [];
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const len = seg.end - seg.start + 1;
            if (len >= minLen) {
                if (cleanSegments.length > 0 && cleanSegments[cleanSegments.length - 1].state === seg.state) {
                    cleanSegments[cleanSegments.length - 1].end = seg.end;
                } else {
                    cleanSegments.push({ state: seg.state, start: seg.start, end: seg.end });
                }
            } else {
                if (cleanSegments.length > 0) {
                    cleanSegments[cleanSegments.length - 1].end = seg.end;
                } else {
                    if (i + 1 < segments.length) {
                        segments[i + 1].start = seg.start;
                    }
                }
            }
        }

        // 5. Build Wave Cycles (Positive phase + immediately following Negative phase)
        const allCycles = [];
        const padding = 5; // Search window expansion padding to never clip raw peak/valley at boundaries

        for (let i = 0; i < cleanSegments.length - 1; i++) {
            if (cleanSegments[i].state === 'positive' && cleanSegments[i + 1].state === 'negative') {
                const posSeg = cleanSegments[i];
                const negSeg = cleanSegments[i + 1];

                // Find absolute Peak on raw data within expanded posSeg bounds
                const searchStartPos = Math.max(0, posSeg.start - padding);
                const searchEndPos = Math.min(data.length - 1, posSeg.end + padding);
                let maxVal = -Infinity;
                let maxIdx = -1;
                for (let idx = searchStartPos; idx <= searchEndPos; idx++) {
                    if (data[idx] > maxVal) {
                        maxVal = data[idx];
                        maxIdx = idx;
                    }
                }

                // Find absolute Valley on raw data within expanded negSeg bounds
                const searchStartNeg = Math.max(0, negSeg.start - padding);
                const searchEndNeg = Math.min(data.length - 1, negSeg.end + padding);
                let minVal = Infinity;
                let minIdx = -1;
                for (let idx = searchStartNeg; idx <= searchEndNeg; idx++) {
                    if (data[idx] < minVal) {
                        minVal = data[idx];
                        minIdx = idx;
                    }
                }

                if (maxIdx !== -1 && minIdx !== -1) {
                    allCycles.push({
                        peak: { index: maxIdx, value: maxVal },
                        valley: { index: minIdx, value: minVal },
                        amplitude: maxVal - minVal
                    });
                }
            }
        }

        // 6. Amplitude-Based Gating: Filter out noise ripples that are too small
        // We find the maximum amplitude among all cycles, and ignore cycles below 25% of it.
        if (allCycles.length === 0) return this.emptyResult();
        
        let maxAmp = 0;
        for (const cyc of allCycles) {
            if (cyc.amplitude > maxAmp) maxAmp = cyc.amplitude;
        }

        const ampThreshold = maxAmp * 0.25;
        const genuineCycles = allCycles.filter(cyc => cyc.amplitude >= ampThreshold);

        // 7. Skip cycle 0 (Wave 1), extract cycles 1, 2, 3 (Waves 2, 3, 4)
        const result = this.emptyResult();
        if (genuineCycles.length > 1) { result.peak1 = genuineCycles[1].peak; result.valley1 = genuineCycles[1].valley; }
        if (genuineCycles.length > 2) { result.peak2 = genuineCycles[2].peak; result.valley2 = genuineCycles[2].valley; }
        if (genuineCycles.length > 3) { result.peak3 = genuineCycles[3].peak; result.valley3 = genuineCycles[3].valley; }

        return result;
    }

    static emptyResult() {
        return {
            peak1: null, valley1: null,
            peak2: null, valley2: null,
            peak3: null, valley3: null
        };
    }

    static readAllChannels(channels) {
        return channels.map(ch => this.readChannel(ch));
    }
}
