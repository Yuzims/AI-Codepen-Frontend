import React, { useRef, useEffect } from 'react';

interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  threshold?: number;
}

const SparklineChart: React.FC<SparklineChartProps> = ({
  data,
  width = 120,
  height = 32,
  color = '#0366d6',
  threshold
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const max = Math.max(...data, threshold ?? 0) * 1.1 || 1;
    const stepX = width / (data.length - 1);

    if (threshold) {
      const thresholdY = height - (threshold / max) * height;
      ctx.strokeStyle = '#d73a49';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, thresholdY);
      ctx.lineTo(width, thresholdY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const y = height - (data[i] / max) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const lastValue = data[data.length - 1];
    if (threshold && lastValue > threshold) {
      const lastX = (data.length - 1) * stepX;
      const lastY = height - (lastValue / max) * height;
      ctx.fillStyle = '#d73a49';
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [data, width, height, color, threshold]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: 'block' }}
    />
  );
};

export default SparklineChart;
