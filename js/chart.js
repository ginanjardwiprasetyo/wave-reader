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
        const colors = ['#db2777', '#0284c7', '#0d9488', '#ea580c', '#7c3aed', '#2563eb'];

        const option = {
            title: {
                text: `Wave Visualization — ${fileData.filename}`,
                left: 'left',
                textStyle: {
                    color: '#0f172a',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 15,
                    fontWeight: 700
                }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross',
                    label: { backgroundColor: '#db2777' }
                },
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                textStyle: { color: '#0f172a' }
            },
            legend: {
                bottom: 5,
                type: 'scroll',
                textStyle: { fontFamily: 'Inter, sans-serif', color: '#475569' }
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
                        lineStyle: { color: '#db2777' },
                        areaStyle: { color: 'rgba(219, 39, 119, 0.1)' }
                    }
                }
            ],
            xAxis: {
                type: 'category',
                name: 'Index',
                nameTextStyle: { color: '#64748b' },
                axisLine: { lineStyle: { color: '#cbd5e1' } },
                axisLabel: { color: '#64748b' }
            },
            yAxis: {
                type: 'value',
                name: 'mm',
                nameTextStyle: { color: '#64748b' },
                axisLine: { lineStyle: { color: '#cbd5e1' } },
                splitLine: { lineStyle: { color: '#f1f5f9' } },
                axisLabel: { color: '#64748b' }
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
                addMark(reading.peak1, 'P1');
                addMark(reading.valley1, 'V1');
                addMark(reading.peak2, 'P2');
                addMark(reading.valley2, 'V2');
                addMark(reading.peak3, 'P3');
                addMark(reading.valley3, 'V3');
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
                        formatter: (params) => `${params.name}\n${parseFloat(params.value).toFixed(2)}`
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
