export class WaveReader {
    /**
     * Read wave cycles from raw channel data using an advanced algorithm:
     *
     * 1. Hampel Filter        — removes sudden spikes/outliers without distorting wave shape
     * 2. Gaussian Smoothing    — preserves peak/valley shape better than simple MA
     * 3. Schmitt-Trigger       — hysteresis-based segmentation (positive/negative phases)
     * 4. Trend Confirmation    — a candidate peak/valley is only committed when the data
     *                            *consistently* reverses direction afterward
     * 5. Prominence Filtering  — rejects shallow/incomplete formations
     *
     * Peak and Valley values are always extracted from the RAW (unfiltered) data.
     */
    static readChannel(data) {
        if (!data || data.length < 10) return this.emptyResult();

        // ─── 0. Basic stats on raw data ────────────────────────────
        let rawMin = Infinity;
        let rawMax = -Infinity;
        for (const v of data) {
            if (v < rawMin) rawMin = v;
            if (v > rawMax) rawMax = v;
        }
        const rawRange = rawMax - rawMin;
        if (rawRange === 0) return this.emptyResult();

        // ─── 1. Hampel Filter — spike suppression ──────────────────
        // Replaces outliers (points deviating > 3 * MAD from local median) with median.
        // This handles the "nilai mendadak berubah" case without distorting the wave.
        const despiked = this._hampelFilter(data, 7, 3.0);

        // ─── 2. Gaussian-Weighted Smoothing ────────────────────────
        // Gaussian kernel preserves peak/valley shape much better than a box/simple MA.
        // Adaptive window based on data length.
        const gaussWindow = Math.max(11, Math.min(31, Math.floor(data.length / 40) | 1));
        const smoothed = this._gaussianSmooth(despiked, gaussWindow);

        // ─── 3. Slow baseline for detrending ───────────────────────
        const slowWindow = Math.min(151, Math.floor(data.length / 3) | 1);
        const baseline = this._simpleMA(despiked, slowWindow);

        // Hysteresis band: 12% of raw range (increased from 8% for more noise immunity)
        const H = rawRange * 0.12;

        // ─── 4. Schmitt-Trigger Segmentation ───────────────────────
        const states = [];
        let curState = smoothed[0] >= baseline[0] ? 'positive' : 'negative';
        states.push(curState);

        for (let i = 1; i < data.length; i++) {
            if (curState === 'positive') {
                if (smoothed[i] < baseline[i] - H) {
                    curState = 'negative';
                }
            } else {
                if (smoothed[i] >= baseline[i] + H) {
                    curState = 'positive';
                }
            }
            states.push(curState);
        }

        // Group into segments
        const segments = [];
        let segStart = 0;
        let segState = states[0];
        for (let i = 1; i < states.length; i++) {
            if (states[i] !== segState) {
                segments.push({ state: segState, start: segStart, end: i - 1 });
                segState = states[i];
                segStart = i;
            }
        }
        segments.push({ state: segState, start: segStart, end: states.length - 1 });

        // Merge segments that are too short (< minLen) into neighbours
        const minLen = data.length < 50 ? 2 : Math.max(10, Math.floor(data.length / 80));

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
                // Absorb into the previous segment (or push to next if first)
                if (cleanSegments.length > 0) {
                    cleanSegments[cleanSegments.length - 1].end = seg.end;
                } else if (i + 1 < segments.length) {
                    segments[i + 1].start = seg.start;
                }
            }
        }

        // ─── 5. Build Wave Cycles with Trend Confirmation ──────────
        const allCycles = [];
        const padding = 5;
        // Confirmation window: how many points must consistently reverse
        // to confirm that a peak/valley is real (not a temporary plateau).
        const confirmLen = Math.max(5, Math.floor(data.length / 100));

        for (let i = 0; i < cleanSegments.length - 1; i++) {
            if (cleanSegments[i].state === 'positive' && cleanSegments[i + 1].state === 'negative') {
                const posSeg = cleanSegments[i];
                const negSeg = cleanSegments[i + 1];

                // ── Find Peak with trend confirmation ──
                const peakResult = this._findConfirmedExtremum(
                    data, smoothed, posSeg, padding, 'peak', confirmLen
                );

                // ── Find Valley with trend confirmation ──
                const valleyResult = this._findConfirmedExtremum(
                    data, smoothed, negSeg, padding, 'valley', confirmLen
                );

                if (peakResult && valleyResult) {
                    allCycles.push({
                        peak: peakResult,
                        valley: valleyResult,
                        amplitude: peakResult.value - valleyResult.value
                    });
                }
            }
        }

        // ─── 6. Prominence-Based Filtering ─────────────────────────
        if (allCycles.length === 0) return this.emptyResult();

        // Calculate prominence for each cycle
        this._calculateProminence(allCycles, data);

        // Find max prominence
        let maxProm = 0;
        for (const cyc of allCycles) {
            if (cyc.prominence > maxProm) maxProm = cyc.prominence;
        }

        // Keep cycles with prominence >= 30% of max AND amplitude >= 25% of max amplitude
        let maxAmp = 0;
        for (const cyc of allCycles) {
            if (cyc.amplitude > maxAmp) maxAmp = cyc.amplitude;
        }
        const promThreshold = maxProm * 0.30;
        const ampThreshold = maxAmp * 0.25;

        const genuineCycles = allCycles.filter(
            cyc => cyc.prominence >= promThreshold && cyc.amplitude >= ampThreshold
        );

        // ─── 7. Extract results (skip cycle 0 = Wave 1) ───────────
        const result = this.emptyResult();
        if (genuineCycles.length > 1) { result.peak1 = genuineCycles[1].peak; result.valley1 = genuineCycles[1].valley; }
        if (genuineCycles.length > 2) { result.peak2 = genuineCycles[2].peak; result.valley2 = genuineCycles[2].valley; }
        if (genuineCycles.length > 3) { result.peak3 = genuineCycles[3].peak; result.valley3 = genuineCycles[3].valley; }

        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    //  HELPER: Hampel Filter — Median-based outlier removal
    // ═══════════════════════════════════════════════════════════════
    /**
     * For each point, compare it to the median of its local window.
     * If it deviates by more than `threshold * MAD` (median absolute deviation),
     * replace it with the local median. This kills sudden spikes without
     * affecting the overall wave shape.
     */
    static _hampelFilter(data, halfWindow = 7, threshold = 3.0) {
        const n = data.length;
        const result = new Array(n);
        const k = 1.4826; // scale factor for MAD → σ estimation (Gaussian assumption)

        for (let i = 0; i < n; i++) {
            const lo = Math.max(0, i - halfWindow);
            const hi = Math.min(n - 1, i + halfWindow);

            // Extract window and sort for median
            const windowData = [];
            for (let j = lo; j <= hi; j++) windowData.push(data[j]);
            windowData.sort((a, b) => a - b);
            const median = windowData[Math.floor(windowData.length / 2)];

            // Calculate MAD (Median Absolute Deviation)
            const deviations = windowData.map(v => Math.abs(v - median));
            deviations.sort((a, b) => a - b);
            const mad = deviations[Math.floor(deviations.length / 2)];

            const sigma = k * mad;
            if (sigma > 0 && Math.abs(data[i] - median) > threshold * sigma) {
                result[i] = median; // Replace outlier
            } else {
                result[i] = data[i]; // Keep original
            }
        }
        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    //  HELPER: Gaussian-Weighted Moving Average
    // ═══════════════════════════════════════════════════════════════
    /**
     * Apply a Gaussian-kernel smoothing pass. Unlike a simple box MA,
     * this preserves peak/valley shapes better because nearby points
     * get more weight than distant ones.
     */
    static _gaussianSmooth(data, windowSize) {
        const n = data.length;
        const half = Math.floor(windowSize / 2);
        const sigma = half / 2.5;
        const result = new Array(n);

        // Pre-compute kernel weights
        const kernel = new Array(windowSize);
        let kernelSum = 0;
        for (let j = 0; j < windowSize; j++) {
            const x = j - half;
            kernel[j] = Math.exp(-(x * x) / (2 * sigma * sigma));
            kernelSum += kernel[j];
        }
        // Normalise
        for (let j = 0; j < windowSize; j++) kernel[j] /= kernelSum;

        for (let i = 0; i < n; i++) {
            let sum = 0;
            let wSum = 0;
            for (let j = 0; j < windowSize; j++) {
                const idx = i + j - half;
                if (idx >= 0 && idx < n) {
                    sum += data[idx] * kernel[j];
                    wSum += kernel[j];
                }
            }
            result[i] = sum / wSum;
        }
        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    //  HELPER: Simple Moving Average (for baseline)
    // ═══════════════════════════════════════════════════════════════
    static _simpleMA(data, windowSize) {
        const n = data.length;
        const half = Math.floor(windowSize / 2);
        const result = new Array(n);
        for (let i = 0; i < n; i++) {
            let sum = 0;
            let count = 0;
            for (let j = -half; j <= half; j++) {
                const idx = i + j;
                if (idx >= 0 && idx < n) {
                    sum += data[idx];
                    count++;
                }
            }
            result[i] = sum / count;
        }
        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    //  HELPER: Find Confirmed Extremum (Peak or Valley)
    // ═══════════════════════════════════════════════════════════════
    /**
     * Find the true peak/valley within a segment, then CONFIRM it
     * by checking that the smoothed data reverses direction consistently
     * for at least `confirmLen` points afterward.
     *
     * This is the KEY fix for false valleys caused by temporary plateaus:
     * "data melandai sesaat lalu lanjut turun" — the valley candidate
     * will NOT be confirmed because the data doesn't rise consistently.
     */
    static _findConfirmedExtremum(rawData, smoothed, segment, padding, type, confirmLen) {
        const n = rawData.length;
        const searchStart = Math.max(0, segment.start - padding);
        const searchEnd = Math.min(n - 1, segment.end + padding);

        if (type === 'peak') {
            // Find absolute max on raw data within segment bounds
            let bestVal = -Infinity;
            let bestIdx = -1;
            for (let idx = searchStart; idx <= searchEnd; idx++) {
                if (rawData[idx] > bestVal) {
                    bestVal = rawData[idx];
                    bestIdx = idx;
                }
            }

            // Trend confirmation: after the peak, smoothed data should decrease
            // consistently for at least `confirmLen` points
            if (bestIdx !== -1 && bestIdx + confirmLen < n) {
                let descendCount = 0;
                for (let k = 1; k <= confirmLen; k++) {
                    if (smoothed[bestIdx + k] <= smoothed[bestIdx + k - 1]) {
                        descendCount++;
                    }
                }
                // Require at least 60% of confirmLen points to be descending
                if (descendCount >= Math.ceil(confirmLen * 0.6)) {
                    return { index: bestIdx, value: bestVal };
                }
            }

            // Fallback: if we can't confirm (e.g. at end of data), still return
            // but only if the segment is long enough to be meaningful
            if (bestIdx !== -1 && (searchEnd - searchStart + 1) >= Math.max(5, confirmLen)) {
                return { index: bestIdx, value: bestVal };
            }

            return bestIdx !== -1 ? { index: bestIdx, value: bestVal } : null;

        } else {
            // Valley
            let bestVal = Infinity;
            let bestIdx = -1;
            for (let idx = searchStart; idx <= searchEnd; idx++) {
                if (rawData[idx] < bestVal) {
                    bestVal = rawData[idx];
                    bestIdx = idx;
                }
            }

            // Trend confirmation: after the valley, smoothed data should rise
            // consistently for at least `confirmLen` points.
            // This directly fixes: "melandai sesaat lalu lanjut turun" — 
            // if data doesn't rise after the candidate, it's not a true valley.
            if (bestIdx !== -1 && bestIdx + confirmLen < n) {
                let ascendCount = 0;
                for (let k = 1; k <= confirmLen; k++) {
                    if (smoothed[bestIdx + k] >= smoothed[bestIdx + k - 1]) {
                        ascendCount++;
                    }
                }
                if (ascendCount >= Math.ceil(confirmLen * 0.6)) {
                    return { index: bestIdx, value: bestVal };
                }
            }

            // Fallback for edge cases
            if (bestIdx !== -1 && (searchEnd - searchStart + 1) >= Math.max(5, confirmLen)) {
                return { index: bestIdx, value: bestVal };
            }

            return bestIdx !== -1 ? { index: bestIdx, value: bestVal } : null;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  HELPER: Calculate Prominence for each cycle
    // ═══════════════════════════════════════════════════════════════
    /**
     * Prominence measures how much a peak "stands out" relative to
     * the valleys on either side, and vice versa. A cycle with low
     * prominence is likely a noise ripple or incomplete formation.
     */
    static _calculateProminence(cycles, rawData) {
        for (let i = 0; i < cycles.length; i++) {
            const cyc = cycles[i];
            const peakVal = cyc.peak.value;

            // Find the highest valley on either side (left and right neighbours)
            let leftValley = cyc.valley.value;  // own valley as default
            let rightValley = cyc.valley.value;

            if (i > 0) {
                leftValley = cycles[i - 1].valley.value;
            }
            if (i < cycles.length - 1) {
                rightValley = cycles[i + 1].valley.value;
            }

            // Prominence = peak height above the higher of the two neighbouring valleys
            const higherValley = Math.max(leftValley, rightValley);
            cyc.prominence = peakVal - higherValley;

            // Ensure non-negative
            if (cyc.prominence < 0) cyc.prominence = cyc.amplitude;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Empty result template
    // ═══════════════════════════════════════════════════════════════
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
