import type { PieChartSeries } from '@/shared/excel-report/types';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

export async function fetchPieChartBase64(series: PieChartSeries): Promise<string | null> {
  if (series.labels.length === 0 || series.values.length === 0) {
    return null;
  }

  try {
    const chartConfig = {
      type: 'pie',
      data: {
        labels: series.labels,
        datasets: [
          {
            label: series.title,
            data: series.values,
            backgroundColor: ['#F97316', '#FB923C', '#FDBA74', '#F59E0B', '#38BDF8', '#34D399', '#C084FC', '#A8A29E'],
            borderWidth: 2,
            borderColor: '#FFFFFF',
          },
        ],
      },
      options: {
        responsive: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#1F2937',
              boxWidth: 12,
              boxHeight: 12,
              font: {
                size: 11,
              },
            },
          },
          datalabels: {
            color: '#0F172A',
            font: {
              weight: 'bold',
              size: 10,
            },
          },
          title: {
            display: true,
            text: series.title,
            color: '#111827',
            font: {
              size: 15,
              weight: 'bold',
            },
            padding: {
              bottom: 10,
            },
          },
        },
      },
    };

    const quickChartUrl = `https://quickchart.io/chart?width=920&height=460&format=png&backgroundColor=white&c=${encodeURIComponent(
      JSON.stringify(chartConfig),
    )}`;

    const response = await fetch(quickChartUrl, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const imageBuffer = await response.arrayBuffer();
    return arrayBufferToBase64(imageBuffer);
  } catch {
    return null;
  }
}
