export class ChartVisualizer {
    constructor(containerId) {
        const container = document.getElementById(containerId);
        this.container = container;
        this.chart = echarts.init(container);

        window.addEventListener('resize', () => this.chart.resize());

        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => this.chart.resize());
            ro.observe(container);
        }
    }

    getThemeColors() {
        return {
            text: '#831843',
            textMuted: '#9D174D',
            axisLine: 'rgba(219,39,119,0.15)',
            splitLine: 'rgba(219,39,119,0.06)',
            tooltipBg: 'rgba(255,255,255,0.96)',
            tooltipBorder: 'rgba(219,39,119,0.15)',
            tooltipText: '#831843',
            legendText: '#9D174D',
            gridBg: 'transparent'
        };
    }

    render(fileData, readingData, visibleChannels = null, showLabels = true) {
        const colors = ['#DB2777', '#2563EB', '#E8772E', '#0D9488', '#7C3AED', '#DC2626'];
        const theme = this.getThemeColors();

        const dataLen = fileData.channels[0] ? fileData.channels[0].length : 0;

        const option = {
            title: {
                text: `Wave Visualization — ${fileData.filename}`,
                left: 'center',
                textStyle: {
                    color: theme.text,
                    fontFamily: 'Fira Sans, sans-serif',
                    fontSize: 14,
                    fontWeight: 600
                }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross',
                    label: { backgroundColor: '#DB2777' }
                },
                backgroundColor: theme.tooltipBg,
                borderColor: theme.tooltipBorder,
                borderWidth: 1,
                textStyle: { color: theme.tooltipText, fontFamily: 'Fira Sans, sans-serif' }
            },
            legend: {
                bottom: 5,
                type: 'scroll',
                textStyle: { fontFamily: 'Fira Sans, sans-serif', color: theme.legendText },
                emphasis: { selector: false }
            },
            grid: {
                top: 50,
                bottom: 60,
                left: 55,
                right: 40,
                containLabel: true
            },
            toolbox: {
                right: 10,
                feature: {
                    dataZoom: { yAxisIndex: 'none' },
                    restore: {},
                    saveAsImage: { title: 'Save Image' }
                }
            },
            dataZoom: [
                { type: 'inside', start: 0, end: 100 },
                {
                    type: 'slider', start: 0, end: 100,
                    borderColor: 'transparent',
                    height: 22,
                    bottom: 8,
                    selectedDataBackground: {
                        lineStyle: { color: '#DB2777' },
                        areaStyle: { color: 'rgba(219,39,119,0.12)' }
                    }
                }
            ],
            xAxis: {
                type: 'category',
                name: 'Index',
                nameLocation: 'center',
                nameGap: 35,
                nameTextStyle: { color: theme.textMuted },
                axisLine: { lineStyle: { color: theme.axisLine } },
                axisLabel: {
                    color: theme.text,
                    interval: Math.max(0, Math.floor(dataLen / 30)),
                    rotate: dataLen > 200 ? 30 : 0
                }
            },
            yAxis: {
                type: 'value',
                name: 'mm',
                nameTextStyle: { color: theme.textMuted },
                axisLine: { lineStyle: { color: theme.axisLine } },
                splitLine: { lineStyle: { color: theme.splitLine } },
                axisLabel: { color: theme.textMuted }
            },
            series: []
        };

        fileData.channels.forEach((chData, idx) => {
            if (visibleChannels !== null && !visibleChannels.includes(idx)) return;

            const seriesName = fileData.headers[idx] || `Ch${idx + 1}`;
            const channelColor = colors[idx % colors.length];
            const reading = readingData[idx];

            const markPoints = [];
            if (showLabels && reading) {
                const addMark = (pt, name) => {
                    if (pt) {
                        markPoints.push({
                            name: name,
                            coord: [pt.index, pt.value],
                            value: pt.value.toFixed(2),
                            itemStyle: {
                                color: channelColor,
                                shadowBlur: 8,
                                shadowColor: channelColor
                            },
                            symbolSize: 42
                        });
                    }
                };
                addMark(reading.peak1, `${seriesName} P1`);
                addMark(reading.valley1, `${seriesName} V1`);
                addMark(reading.peak2, `${seriesName} P2`);
                addMark(reading.valley2, `${seriesName} V2`);
                addMark(reading.peak3, `${seriesName} P3`);
                addMark(reading.valley3, `${seriesName} V3`);
            }

            option.series.push({
                name: seriesName,
                type: 'line',
                data: chData,
                sampling: 'lttb',
                itemStyle: { color: channelColor },
                lineStyle: { width: 2 },
                emphasis: { lineStyle: { width: 3 } },
                blur: { lineStyle: { opacity: 0.15 } },
                markPoint: {
                    data: markPoints.map(mp => ({
                        ...mp,
                        symbolSize: 28,
                        label: {
                            show: true,
                            color: '#fff',
                            fontWeight: 'bold',
                            fontSize: 9,
                            fontFamily: 'Fira Sans, sans-serif',
                            backgroundColor: channelColor,
                            padding: [2, 6],
                            borderRadius: 4,
                            position: 'top',
                            formatter: () => `${parseFloat(mp.value).toFixed(2)}`
                        }
                    }))
                }
            });
        });

        if (fileData.channels[0]) {
            option.xAxis.data = Array.from({ length: fileData.channels[0].length }, (_, i) => i);
        }

        this.chart.clear();
        this.chart.setOption(option, true);

        setTimeout(() => this.chart.resize(), 80);
    }

    downloadPng() {
        const url = this.chart.getDataURL({
            type: 'png',
            pixelRatio: 2,
            backgroundColor: '#fff'
        });
        const link = document.createElement('a');
        link.href = url;
        link.download = 'waveform.png';
        link.click();
    }

    resetZoom() {
        this.chart.dispatchAction({ type: 'restore' });
    }
}
