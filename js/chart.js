export class ChartVisualizer {
    constructor(containerId) {
        const container = document.getElementById(containerId);
        this.chart = echarts.init(container);

        window.addEventListener('resize', () => this.chart.resize());

        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => this.chart.resize());
            ro.observe(container);
        }
    }

    render(fileData, readingData, visibleChannels = null, showLabels = true) {
        const colors = ['#DB2777', '#2563EB', '#CA8A04', '#16A34A', '#7C3AED', '#DC2626'];

        const option = {
            title: {
                text: `Wave Visualization — ${fileData.filename}`,
                left: 'left',
                textStyle: {
                    color: '#831843',
                    fontFamily: 'Crimson Pro, serif',
                    fontSize: 16,
                    fontWeight: 600
                }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross',
                    label: { backgroundColor: '#DB2777' }
                },
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderColor: 'rgba(219, 39, 119, 0.15)',
                borderWidth: 1,
                textStyle: { color: '#831843' }
            },
            legend: {
                bottom: 5,
                type: 'scroll',
                textStyle: { fontFamily: 'Atkinson Hyperlegible, sans-serif', color: '#9D174D' }
            },
            grid: {
                top: 60,
                bottom: 60,
                left: 50,
                right: 30,
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
                    selectedDataBackground: {
                        lineStyle: { color: '#DB2777' },
                        areaStyle: { color: 'rgba(219, 39, 119, 0.12)' }
                    }
                }
            ],
            xAxis: {
                type: 'category',
                name: 'Index',
                nameTextStyle: { color: '#9D174D' },
                axisLine: { lineStyle: { color: 'rgba(219, 39, 119, 0.15)' } },
                axisLabel: { color: '#9D174D' }
            },
            yAxis: {
                type: 'value',
                name: 'mm',
                nameTextStyle: { color: '#9D174D' },
                axisLine: { lineStyle: { color: 'rgba(219, 39, 119, 0.15)' } },
                splitLine: { lineStyle: { color: 'rgba(219, 39, 119, 0.06)' } },
                axisLabel: { color: '#9D174D' }
            },
            series: []
        };

        fileData.channels.forEach((chData, idx) => {
            // Skip channels not in the visible filter
            if (visibleChannels !== null && !visibleChannels.includes(idx)) return;

            const seriesName = fileData.headers[idx] || `Ch${idx + 1}`;
            const channelColor = colors[idx % colors.length];
            const reading = readingData[idx];

            // Build markPoints if labels are enabled
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
                markPoint: {
                    data: markPoints,
                    label: {
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: 10,
                        fontFamily: 'Atkinson Hyperlegible, sans-serif',
                        formatter: (params) => {
                            const idx = params.data.coord ? params.data.coord[0] : '';
                            return `${params.name} @${idx}\n${parseFloat(params.value).toFixed(2)}`;
                        }
                    }
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
}
