export class WaveReader {
    static readChannel(data) {
        if (!data || data.length < 20) return this.emptyResult();

        const n = data.length;

        // Reject flat / noise-floor data
        let dmin = Infinity, dmax = -Infinity;
        for (let i = 0; i < n; i++) {
            if (data[i] < dmin) dmin = data[i];
            if (data[i] > dmax) dmax = data[i];
        }
        if (dmax - dmin < 0.5) return this.emptyResult();

        // 1. Baseline: overall median (robust)
        const sorted = [...data].sort((a, b) => a - b);
        const median = sorted[Math.floor(n / 2)];
        const detrended = data.map(v => v - median);

        // 2. Smooth with reflected boundary padding (no edge bias)
        const sw = 7, sh = Math.floor(sw / 2);
        const smooth = new Array(n);
        for (let i = 0; i < n; i++) {
            let sum = 0;
            for (let j = -sh; j <= sh; j++) {
                let idx = i + j;
                if (idx < 0) idx = -idx;
                if (idx >= n) idx = 2 * n - 2 - idx;
                sum += detrended[idx];
            }
            smooth[i] = sum / sw;
        }

        // 3. Adaptive deadband
        let sumAbs = 0;
        for (let i = 0; i < n; i++) sumAbs += Math.abs(detrended[i]);
        const db = Math.max(0.1, (sumAbs / n) * 0.07);

        // 4. Zero crossings via state-tracking (handles plateaus at 0)
        const xs = [];
        if (smooth[0] >= 0) xs.push({ i: 0, d: 'up' });
        else xs.push({ i: 0, d: 'down' });
        let lastSign = smooth[0] >= 0 ? 1 : -1;
        const eps = 0.01;
        for (let i = 0; i < n; i++) {
            if (smooth[i] > eps && lastSign < 0) { xs.push({ i, d: 'up' }); lastSign = 1; }
            else if (smooth[i] < -eps && lastSign > 0) { xs.push({ i, d: 'down' }); lastSign = -1; }
        }
        const lastDir = xs.length > 0 ? xs[xs.length - 1].d : null;
        if (lastDir === 'up') xs.push({ i: n - 1, d: 'down' });
        else if (lastDir === 'down') xs.push({ i: n - 1, d: 'up' });

        // 5. Filter crossings: min gap, alternation, amplitude check
        const filt = [xs[0]];
        for (let i = 1; i < xs.length; i++) {
            const prev = filt[filt.length - 1];
            if (xs[i].i - prev.i < 4) continue;
            if (xs[i].d === prev.d) continue;

            const a = prev.i, b = xs[i].i;
            let segMax = -Infinity, segMin = Infinity;
            for (let j = a; j <= b; j++) {
                if (smooth[j] > segMax) segMax = smooth[j];
                if (smooth[j] < segMin) segMin = smooth[j];
            }
            if (segMax - segMin < db) continue;

            filt.push(xs[i]);
        }
        if (filt.length < 3) return this.emptyResult();

        // 6. Extract true extrema from RAW data between crossings
        const ext = [];
        for (let i = 0; i < filt.length - 1; i++) {
            const a = filt[i].i, b = filt[i + 1].i;
            const isPeak = filt[i].d === 'up' && filt[i + 1].d === 'down';
            const isValley = filt[i].d === 'down' && filt[i + 1].d === 'up';
            if (!isPeak && !isValley) continue;

            let ev = isPeak ? -Infinity : Infinity, ei = -1;
            const pad = Math.max(1, Math.floor((b - a) / 10));
            const ss = Math.max(1, a - pad), se = Math.min(n - 2, b + pad);
            for (let j = ss; j <= se; j++) {
                if ((isPeak && data[j] > ev) || (isValley && data[j] < ev)) { ev = data[j]; ei = j; }
            }
            if (ei !== -1) ext.push({ t: isPeak ? 'P' : 'V', i: ei, v: ev });
        }
        if (ext.length < 2) return this.emptyResult();

        // 7. Must start with P and end with V
        if (ext[0].t === 'V') ext.shift();
        if (ext.length > 0 && ext[ext.length - 1].t === 'P') ext.pop();
        if (ext.length < 2) return this.emptyResult();

        // 8. Pair P + next V into cycles
        const rawCycles = [];
        for (let i = 0; i < ext.length; i += 2) {
            const peak = ext[i];
            const valley = i + 1 < ext.length ? ext[i + 1] : null;
            if (!peak || peak.t !== 'P') continue;
            if (valley && valley.t === 'V') {
                rawCycles.push({
                    peak: { index: peak.i, value: peak.v },
                    valley: { index: valley.i, value: valley.v },
                    amplitude: peak.v - valley.v
                });
            }
        }
        if (rawCycles.length === 0) return this.emptyResult();

        // 9. Merge shallow-valley cycles with next cycle (handles double-wave pattern)
        const valleyThresh = -(db * 10);
        const cycles = [];
        for (let i = 0; i < rawCycles.length; i++) {
            const c = rawCycles[i];
            if (c.valley.value > valleyThresh && i + 1 < rawCycles.length) {
                const nxt = rawCycles[i + 1];
                cycles.push({
                    peak: c.peak,
                    valley: nxt.valley,
                    amplitude: c.peak.value - nxt.valley.value
                });
                i++;
            } else {
                cycles.push(c);
            }
        }
        if (cycles.length === 0) return this.emptyResult();

        // 10. Amplitude gating: reject cycles < 15% of max
        let maxA = 0;
        for (const c of cycles) if (c.amplitude > maxA) maxA = c.amplitude;
        let valid = cycles.filter(c => c.amplitude >= maxA * 0.15);
        if (valid.length === 0) return this.emptyResult();

        // 11. Valley depth filter: reject remaining cycles with shallow valley
        valid = valid.filter(c => c.valley.value < valleyThresh);
        if (valid.length === 0) return this.emptyResult();

        // 12. Skip first wave, return next 3
        const r = this.emptyResult();
        if (valid.length > 1) { r.peak1 = valid[1].peak; r.valley1 = valid[1].valley; }
        if (valid.length > 2) { r.peak2 = valid[2].peak; r.valley2 = valid[2].valley; }
        if (valid.length > 3) { r.peak3 = valid[3].peak; r.valley3 = valid[3].valley; }
        return r;
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
