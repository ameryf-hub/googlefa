import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, Sliders, Activity, Info } from 'lucide-react';
import { EchoViewType, EchoMeasurement } from '../types';

interface EchoViewerProps {
  viewType: EchoViewType;
  imageUrl?: string; // If the user uploaded a custom static image
  onMeasurementChange?: (measurements: Partial<EchoMeasurement>) => void;
  gain: number;
  contrast: number;
  colorMap: 'gray' | 'blue' | 'amber';
  onGainChange: (g: number) => void;
  onContrastChange: (c: number) => void;
  onColorMapChange: (map: 'gray' | 'blue' | 'amber') => void;
}

export default function EchoViewer({
  viewType,
  imageUrl,
  onMeasurementChange,
  gain,
  contrast,
  colorMap,
  onGainChange,
  onContrastChange,
  onColorMapChange,
}: EchoViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [frame, setFrame] = useState(0);
  const [fps, setFps] = useState(30);
  
  // Interactive Caliper measurement state
  const [calipers, setCalipers] = useState<{ x1: number; y1: number; x2: number; y2: number; label: string }[]>([]);
  const [activeCaliperIdx, setActiveCaliperIdx] = useState<number | null>(null);
  const [isDrawingCaliper, setIsDrawingCaliper] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<{ caliperIdx: number; node: 'start' | 'end' } | null>(null);
  const [isDraggingNode, setIsDraggingNode] = useState<boolean>(false);

  // Calibration scale: 1 pixel = 0.35 mm in our simulated coordinates
  const MM_PER_PIXEL = 0.35;

  // Track playback animation frame
  const animRef = useRef<number | null>(null);

  // Automatically cycle frames if playing
  useEffect(() => {
    let lastTime = performance.now();
    const tick = (now: number) => {
      if (isPlaying && !imageUrl) {
        const elapsed = now - lastTime;
        const interval = 1000 / fps;
        if (elapsed >= interval) {
          setFrame((prev) => (prev + 1) % 60); // 60 frames cycle
          lastTime = now - (elapsed % interval);
        }
      }
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, fps, imageUrl]);

  // Redraw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    
    // Draw sector grid background (ultrasound fan)
    drawUltrasoundFan(ctx, width, height);

    if (imageUrl) {
      // Draw uploaded custom static image
      const img = new Image();
      img.src = imageUrl;
      img.onload = () => {
        ctx.save();
        maskSector(ctx, width, height);
        ctx.filter = `brightness(${gain}%) contrast(${contrast}%)`;
        ctx.drawImage(img, 20, 20, width - 40, height - 120);
        ctx.restore();
        
        drawScaleOverlays(ctx, width, height);
        drawCalipers(ctx);
      };
      img.onerror = () => {
        ctx.fillStyle = '#ff3333';
        ctx.font = '14px monospace';
        ctx.fillText('Failed to render loaded image.', 50, height / 2);
      };
    } else {
      ctx.save();
      maskSector(ctx, width, height);
      ctx.filter = `brightness(${gain}%) contrast(${contrast}%)`;
      
      const phase = frame / 60;
      let sysFactor = 0;
      if (frame < 22) {
        sysFactor = Math.sin((frame / 22) * Math.PI / 2);
      } else if (frame < 26) {
        sysFactor = 1.0;
      } else {
        sysFactor = Math.cos(((frame - 26) / 34) * Math.PI / 2);
      }

      if (viewType === 'PLAX') {
        drawPLAXSimulation(ctx, width, height, sysFactor);
      } else if (viewType === 'A4C') {
        drawA4CSimulation(ctx, width, height, sysFactor);
      } else if (viewType === 'PSAX') {
        drawPSAXSimulation(ctx, width, height, sysFactor);
      } else {
        drawPLAXSimulation(ctx, width, height, sysFactor);
      }

      ctx.restore();

      applyColorMapOverlay(ctx, width, height, colorMap);
      drawScaleOverlays(ctx, width, height);
      drawECG(ctx, width, height, frame);
      drawCalipers(ctx);
    }

    ctx.restore();
  }, [viewType, imageUrl, frame, gain, contrast, colorMap, calipers]);

  const maskSector = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.beginPath();
    const centerX = width / 2;
    const centerY = 30;
    const radius = height - 120;
    const startAngle = Math.PI / 2 - 0.55;
    const endAngle = Math.PI / 2 + 0.55;
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.clip();
  };

  const drawUltrasoundFan = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = 30;
    const radius = height - 120;
    const startAngle = Math.PI / 2 - 0.55;
    const endAngle = Math.PI / 2 + 0.55;

    ctx.fillStyle = '#0a0a0d';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#1e1e24';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + radius * Math.sin(0.55), centerY + radius * Math.cos(0.55));
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX - radius * Math.sin(0.55), centerY + radius * Math.cos(0.55));
    ctx.stroke();

    ctx.setLineDash([4, 6]);
    for (let r = 80; r < radius; r += 80) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, startAngle, endAngle);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  };

  const drawScaleOverlays = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = 30;
    const radius = height - 120;

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '11px monospace';
    
    ctx.fillText('PHILIPS EPIQ CVx', 15, 25);
    ctx.fillText('FR 45Hz', 15, 40);
    ctx.fillText('G: 52% / C: 50', 15, 55);

    ctx.fillText('TIS 0.3  MI 1.2', width - 120, 25);
    ctx.fillText(`VIEW: ${viewType}`, width - 120, 40);
    ctx.fillText(`FREQ: 4.5 MHz`, width - 120, 55);

    ctx.fillStyle = '#71717a';
    ctx.font = '10px sans-serif';
    for (let r = 80; r < radius; r += 80) {
      const depthCm = Math.round(r * MM_PER_PIXEL / 10);
      const x = centerX + r * Math.sin(0.53) + 6;
      const y = centerY + r * Math.cos(0.53);
      ctx.fillText(`${depthCm}cm`, x, y + 4);
      
      ctx.beginPath();
      ctx.strokeStyle = '#52525b';
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x - 4, y);
      ctx.stroke();
    }
  };

  const applyColorMapOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number, map: 'gray' | 'blue' | 'amber') => {
    if (map === 'gray') return;
    
    ctx.save();
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = map === 'blue' ? 'rgba(0, 100, 255, 0.25)' : 'rgba(255, 140, 0, 0.2)';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = map === 'blue' ? 'rgba(0, 40, 120, 0.15)' : 'rgba(120, 60, 0, 0.12)';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  };

  const drawPLAXSimulation = (ctx: CanvasRenderingContext2D, width: number, height: number, sysFactor: number) => {
    const cx = width / 2;
    const cy = height / 2 - 10;

    ctx.fillStyle = '#222227';
    ctx.strokeStyle = '#44444c';
    ctx.lineWidth = 2.5;

    const wallThickening = 5 * sysFactor;
    const lvContractionX = 14 * sysFactor;
    const lvContractionY = 8 * sysFactor;

    ctx.beginPath();
    ctx.ellipse(cx - 30, cy + 40, 80 + wallThickening, 35 + wallThickening, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx - 20, cy - 35, 75 + wallThickening, 25 + wallThickening, -0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#020204';
    
    ctx.beginPath();
    ctx.ellipse(cx - 35, cy, 70 - lvContractionX, 28 - lvContractionY, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx + 60, cy + 18, 32 + (5 * sysFactor), 22 + (4 * sysFactor), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx + 50, cy - 30, 26, 18, -0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#b4b4bf';
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    ctx.ellipse(cx - 35, cy, 70 - lvContractionX, 28 - lvContractionY, 0.1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#5a5a63';
    ctx.beginPath();
    ctx.ellipse(cx - 30, cy + 40, 80 + wallThickening, 35 + wallThickening, 0.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx - 20, cy - 35, 75 + wallThickening, 25 + wallThickening, -0.1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#8a8a94';
    ctx.beginPath();
    ctx.ellipse(cx + 60, cy + 18, 32 + (5 * sysFactor), 22 + (4 * sysFactor), 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(cx + 50, cy - 30, 26, 18, -0.15, 0, Math.PI * 2);
    ctx.stroke();

    const mvOpenAmount = (1 - sysFactor);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.8;

    const mitralAnnulusX = cx + 24;
    const mitralAnnulusY = cy + 10;

    ctx.beginPath();
    ctx.moveTo(mitralAnnulusX, mitralAnnulusY - 8);
    const alX = mitralAnnulusX - 25;
    const alY = mitralAnnulusY + (10 * sysFactor) - (12 * mvOpenAmount);
    ctx.lineTo(alX, alY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(mitralAnnulusX, mitralAnnulusY + 12);
    const plX = mitralAnnulusX - 15;
    const plY = mitralAnnulusY + 12 + (2 * sysFactor) + (8 * mvOpenAmount);
    ctx.lineTo(plX, plY);
    ctx.stroke();

    const avOpenAmount = sysFactor;
    const aoAnnulusX = cx + 25;
    const aoAnnulusY = cy - 25;

    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1.5;

    if (avOpenAmount < 0.3) {
      ctx.beginPath();
      ctx.moveTo(aoAnnulusX, aoAnnulusY);
      ctx.lineTo(aoAnnulusX + 6, aoAnnulusY - 12);
      ctx.moveTo(aoAnnulusX, aoAnnulusY - 18);
      ctx.lineTo(aoAnnulusX + 6, aoAnnulusY - 12);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(aoAnnulusX, aoAnnulusY);
      ctx.quadraticCurveTo(aoAnnulusX + 12, aoAnnulusY - 2, aoAnnulusX + 15, aoAnnulusY);
      ctx.moveTo(aoAnnulusX, aoAnnulusY - 18);
      ctx.quadraticCurveTo(aoAnnulusX + 12, aoAnnulusY - 16, aoAnnulusX + 15, aoAnnulusY - 18);
      ctx.stroke();
    }

    drawSpeckles(ctx, cx - 110, cy - 60, 220, 140, 25);
  };

  const drawA4CSimulation = (ctx: CanvasRenderingContext2D, width: number, height: number, sysFactor: number) => {
    const cx = width / 2;
    const cy = height / 2 - 15;

    const lvContractionX = 12 * sysFactor;
    const lvContractionY = 8 * sysFactor;
    const wallThickening = 4 * sysFactor;

    ctx.fillStyle = '#222227';
    ctx.beginPath();
    ctx.ellipse(cx + 45, cy - 25, 30 + wallThickening, 65 + wallThickening, -0.1, 0, Math.PI * 2);
    ctx.ellipse(cx - 45, cy - 20, 22 + wallThickening, 55 + wallThickening, 0.15, 0, Math.PI * 2);
    ctx.ellipse(cx, cy - 25, 14 + wallThickening, 62 + wallThickening, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#020204';
    
    ctx.beginPath();
    ctx.ellipse(cx + 25, cy - 25, 22 - lvContractionX, 50 - lvContractionY, -0.05, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx - 28, cy - 22, 16 - (8 * sysFactor), 42 - (6 * sysFactor), 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx + 20, cy + 38, 24 + (4 * sysFactor), 24 + (3 * sysFactor), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx - 22, cy + 35, 20 + (3 * sysFactor), 22 + (2 * sysFactor), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#b4b4bf';
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    ctx.ellipse(cx + 25, cy - 25, 22 - lvContractionX, 50 - lvContractionY, -0.05, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(cx - 28, cy - 22, 16 - (8 * sysFactor), 42 - (6 * sysFactor), 0.1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#8a8a94';
    ctx.beginPath();
    ctx.ellipse(cx + 20, cy + 38, 24 + (4 * sysFactor), 24 + (3 * sysFactor), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx - 22, cy + 35, 20 + (3 * sysFactor), 22 + (2 * sysFactor), 0, 0, Math.PI * 2);
    ctx.stroke();

    const mvOpenAmount = (1 - sysFactor);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.8;

    const mvX = cx + 18;
    const mvY = cy + 10;
    ctx.beginPath();
    ctx.moveTo(mvX + 8, mvY);
    ctx.lineTo(mvX - 10, mvY - (15 * mvOpenAmount));
    ctx.moveTo(mvX - 12, mvY);
    ctx.lineTo(mvX + 2, mvY - (10 * mvOpenAmount));
    ctx.stroke();

    const tvX = cx - 18;
    const tvY = cy + 10;
    ctx.beginPath();
    ctx.moveTo(tvX - 6, tvY);
    ctx.lineTo(tvX + 8, tvY - (13 * mvOpenAmount));
    ctx.moveTo(tvX + 10, tvY);
    ctx.lineTo(tvX - 2, tvY - (8 * mvOpenAmount));
    ctx.stroke();

    drawSpeckles(ctx, cx - 80, cy - 65, 160, 140, 22);
  };

  const drawPSAXSimulation = (ctx: CanvasRenderingContext2D, width: number, height: number, sysFactor: number) => {
    const cx = width / 2;
    const cy = height / 2 - 10;

    const lvRadiusOuter = 52 + (4 * sysFactor);
    const lvRadiusInner = 36 - (14 * sysFactor);

    ctx.fillStyle = '#222227';
    ctx.beginPath();
    ctx.arc(cx, cy, lvRadiusOuter, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx - 28, cy - 14, 45 + (3 * sysFactor), Math.PI * 1.0, Math.PI * 1.85);
    ctx.arc(cx - 15, cy - 8, 38 - (2 * sysFactor), Math.PI * 1.85, Math.PI * 1.0, true);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#020204';
    ctx.beginPath();
    ctx.arc(cx, cy, lvRadiusInner, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx - 22, cy - 10, 40 - (4 * sysFactor), Math.PI * 1.05, Math.PI * 1.8);
    ctx.arc(cx - 15, cy - 8, 34 - (6 * sysFactor), Math.PI * 1.8, Math.PI * 1.05, true);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#b4b4bf';
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    ctx.arc(cx, cy, lvRadiusInner, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#8a8a94';
    ctx.beginPath();
    ctx.arc(cx - 22, cy - 10, 40 - (4 * sysFactor), Math.PI * 1.05, Math.PI * 1.8);
    ctx.stroke();

    ctx.fillStyle = '#2d2d34';
    ctx.strokeStyle = '#8a8a94';
    ctx.lineWidth = 1;

    const pmThick = 6 + (5 * sysFactor);
    const pmAngle1 = Math.PI * 0.25;
    const pmAngle2 = Math.PI * 0.85;

    const pmX1 = cx + (lvRadiusInner - 4 - (2 * sysFactor)) * Math.cos(pmAngle1);
    const pmY1 = cy + (lvRadiusInner - 4 - (2 * sysFactor)) * Math.sin(pmAngle1);
    ctx.beginPath();
    ctx.arc(pmX1, pmY1, pmThick, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const pmX2 = cx + (lvRadiusInner - 4 - (2 * sysFactor)) * Math.cos(pmAngle2);
    const pmY2 = cy + (lvRadiusInner - 4 - (2 * sysFactor)) * Math.sin(pmAngle2);
    ctx.beginPath();
    ctx.arc(pmX2, pmY2, pmThick, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    drawSpeckles(ctx, cx - 75, cy - 75, 150, 150, 20);
  };

  const drawSpeckles = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, count: number) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let i = 0; i < count; i++) {
      const sx = x + Math.random() * w;
      const sy = y + Math.random() * h;
      ctx.fillRect(sx, sy, 1.2, 1.2);
    }
  };

  const drawECG = (ctx: CanvasRenderingContext2D, width: number, height: number, frame: number) => {
    const startY = height - 55;
    
    ctx.fillStyle = 'rgba(10, 10, 12, 0.7)';
    ctx.fillRect(15, height - 85, width - 30, 60);
    ctx.strokeStyle = 'rgba(63, 63, 70, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(15, height - 85, width - 30, 60);

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(63, 63, 70, 0.15)';
    for (let x = 20; x < width - 20; x += 15) {
      ctx.moveTo(x, height - 85);
      ctx.lineTo(x, height - 25);
    }
    for (let y = height - 85; y < height - 25; y += 15) {
      ctx.moveTo(15, y);
      ctx.lineTo(width - 15, y);
    }
    ctx.stroke();

    const getECGValue = (f: number) => {
      f = f % 60;
      if (f < 8) return Math.sin((f / 8) * Math.PI) * 4;
      if (f < 14) return 0;
      if (f === 14) return -3;
      if (f === 15) return 22;
      if (f === 16) return -8;
      if (f === 17) return 0;
      if (f >= 25 && f < 42) return Math.sin(((f - 25) / 17) * Math.PI) * 7;
      return 0;
    };

    ctx.beginPath();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;

    const scaleX = (width - 60) / 60;
    for (let f = 0; f < 60; f++) {
      const px = 30 + f * scaleX;
      const py = startY - getECGValue(f);
      if (f === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    const cursorX = 30 + frame * scaleX;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cursorX, startY - getECGValue(frame), 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.beginPath();
    ctx.moveTo(cursorX, height - 85);
    ctx.lineTo(cursorX, height - 25);
    ctx.stroke();

    ctx.fillStyle = '#86efac';
    ctx.font = '9px monospace';
    ctx.fillText('ECG MONITOR (II)', 25, height - 73);

    const bpm = Math.round(fps * 60);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`HR: ${bpm} BPM`, width - 110, height - 71);
    
    if (frame >= 15 && frame <= 18) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(width - 120, height - 75, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawCalipers = (ctx: CanvasRenderingContext2D) => {
    calipers.forEach((cal, idx) => {
      const { x1, y1, x2, y2, label } = cal;
      const isActive = idx === activeCaliperIdx;

      ctx.beginPath();
      ctx.strokeStyle = isActive ? '#fbbf24' : '#fb7185';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = isActive ? '#fbbf24' : '#fb7185';
      
      ctx.beginPath();
      ctx.arc(x1, y1, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x2, y2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const dx = x2 - x1;
      const dy = y2 - y1;
      const pixelDistance = Math.sqrt(dx * dx + dy * dy);
      const mmDistance = (pixelDistance * MM_PER_PIXEL).toFixed(1);

      ctx.fillStyle = '#000000';
      const labelText = `${label || `Dist ${idx + 1}`}: ${mmDistance} mm`;
      ctx.font = 'bold 10px monospace';
      const textWidth = ctx.measureText(labelText).width;

      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 - 10;

      ctx.fillStyle = isActive ? '#fef3c7' : '#ffe4e6';
      ctx.fillRect(mx - textWidth / 2 - 4, my - 9, textWidth + 8, 14);
      ctx.strokeStyle = isActive ? '#d97706' : '#e11d48';
      ctx.strokeRect(mx - textWidth / 2 - 4, my - 9, textWidth + 8, 14);

      ctx.fillStyle = '#0f172a';
      ctx.fillText(labelText, mx - textWidth / 2, my + 1);
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (hoveredNode) {
      setActiveCaliperIdx(hoveredNode.caliperIdx);
      setIsDraggingNode(true);
      return;
    }

    setIsDrawingCaliper(true);
    const newIdx = calipers.length;
    const labels = ['LVIDd', 'LVIDs', 'IVS', 'LVPW', 'LA Size', 'Aortic Root'];
    const label = labels[newIdx] || `Measurement ${newIdx + 1}`;
    
    setCalipers([...calipers, { x1: x, y1: y, x2: x, y2: y, label }]);
    setActiveCaliperIdx(newIdx);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDrawingCaliper && activeCaliperIdx !== null) {
      const updated = [...calipers];
      updated[activeCaliperIdx].x2 = x;
      updated[activeCaliperIdx].y2 = y;
      setCalipers(updated);
      return;
    }

    if (isDraggingNode && activeCaliperIdx !== null && hoveredNode) {
      const updated = [...calipers];
      const cal = updated[activeCaliperIdx];
      if (hoveredNode.node === 'start') {
        cal.x1 = x;
        cal.y1 = y;
      } else {
        cal.x2 = x;
        cal.y2 = y;
      }
      setCalipers(updated);
      triggerMeasurementUpdate(updated);
      return;
    }

    let foundHover: typeof hoveredNode = null;
    for (let i = 0; i < calipers.length; i++) {
      const cal = calipers[i];
      const dStart = Math.sqrt((x - cal.x1) ** 2 + (y - cal.y1) ** 2);
      const dEnd = Math.sqrt((x - cal.x2) ** 2 + (y - cal.y2) ** 2);

      if (dStart < 8) {
        foundHover = { caliperIdx: i, node: 'start' };
        break;
      }
      if (dEnd < 8) {
        foundHover = { caliperIdx: i, node: 'end' };
        break;
      }
    }
    setHoveredNode(foundHover);
  };

  const handleMouseUp = () => {
    setIsDrawingCaliper(false);
    setIsDraggingNode(false);
    triggerMeasurementUpdate(calipers);
  };

  const triggerMeasurementUpdate = (currentCalipers: typeof calipers) => {
    if (!onMeasurementChange) return;
    const measurements: Partial<EchoMeasurement> = {};
    currentCalipers.forEach((cal) => {
      const dx = cal.x2 - cal.x1;
      const dy = cal.y2 - cal.y1;
      const val = Math.round(Math.sqrt(dx * dx + dy * dy) * MM_PER_PIXEL * 10) / 10;
      
      if (cal.label === 'LVIDd') measurements.lvid_d = val;
      else if (cal.label === 'LVIDs') measurements.lvid_s = val;
      else if (cal.label === 'IVS') measurements.ivs = val;
      else if (cal.label === 'LVPW') measurements.lvpw = val;
      else if (cal.label === 'LA Size') measurements.la_size = val;
      else if (cal.label === 'Aortic Root') measurements.ao_root = val;
    });

    onMeasurementChange(measurements);
  };

  const clearCalipers = () => {
    setCalipers([]);
    setActiveCaliperIdx(null);
    if (onMeasurementChange) {
      onMeasurementChange({
        lvid_d: undefined,
        lvid_s: undefined,
        ivs: undefined,
        lvpw: undefined,
        la_size: undefined,
        ao_root: undefined,
      });
    }
  };

  return (
    <div className="flex flex-col bg-zinc-950/40 rounded-xl border border-zinc-800/80 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/60 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold font-mono text-zinc-300 uppercase tracking-wider">
            Real-time Cine Loop Viewer
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-zinc-950 px-2 py-1 rounded-md border border-zinc-800 text-[10px] text-zinc-400 font-mono">
            Scale: {(1 / MM_PER_PIXEL).toFixed(1)} px/mm
          </div>
          <button
            onClick={clearCalipers}
            className="px-2.5 py-1 text-[10px] font-semibold text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-500/50 bg-rose-500/5 rounded transition-all"
          >
            Clear Calipers
          </button>
        </div>
      </div>

      <div className="relative flex justify-center bg-black p-4 select-none">
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`rounded-lg max-w-full aspect-[4/3] bg-zinc-950 border border-zinc-900 shadow-inner ${
            hoveredNode ? 'cursor-move' : 'cursor-crosshair'
          }`}
        />

        <div className="absolute top-6 left-6 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded text-[10px] text-zinc-400 border border-zinc-800">
          <Info className="w-3.5 h-3.5 text-indigo-400" />
          <span>Click & drag directly on ultrasound to place measurement calipers</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4 bg-zinc-900/40 border-t border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={!!imageUrl}
              className={`p-2.5 rounded-lg border transition-all ${
                imageUrl
                  ? 'bg-zinc-800 text-zinc-600 border-zinc-700/50 cursor-not-allowed'
                  : isPlaying
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setFrame(0)}
              disabled={!!imageUrl}
              className="p-2.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-lg transition-all"
              title="Reset Frame"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-w-[200px] flex items-center gap-3">
            <span className="text-[10px] font-mono text-zinc-500 w-12">
              FR: {frame + 1} / 60
            </span>
            <input
              type="range"
              min="0"
              max="59"
              value={frame}
              disabled={isPlaying || !!imageUrl}
              onChange={(e) => setFrame(parseInt(e.target.value))}
              className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Sliders className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-zinc-400 text-[11px] font-mono">Sweep Speed:</span>
            <select
              value={fps}
              disabled={!!imageUrl}
              onChange={(e) => setFps(parseInt(e.target.value))}
              className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="15">Half Speed (15 Hz)</option>
              <option value="30">Standard (30 Hz)</option>
              <option value="45">Fast Scan (45 Hz)</option>
              <option value="60">Max Precision (60 Hz)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-zinc-800/60">
          <div>
            <div className="flex justify-between text-[11px] text-zinc-400 mb-1 font-mono">
              <span>Acoustic Gain</span>
              <span>{gain}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="150"
              value={gain}
              onChange={(e) => onGainChange(parseInt(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-zinc-400 mb-1 font-mono">
              <span>Tissue Contrast</span>
              <span>{contrast}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="150"
              value={contrast}
              onChange={(e) => onContrastChange(parseInt(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-zinc-400 mb-1 font-mono">
              <span>Colormap</span>
              <span className="capitalize">{colorMap}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => onColorMapChange('gray')}
                className={`py-1 text-[10px] font-semibold rounded border uppercase tracking-wider ${
                  colorMap === 'gray'
                    ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                Grayscale
              </button>
              <button
                onClick={() => onColorMapChange('blue')}
                className={`py-1 text-[10px] font-semibold rounded border uppercase tracking-wider ${
                  colorMap === 'blue'
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                Ice Blue
              </button>
              <button
                onClick={() => onColorMapChange('amber')}
                className={`py-1 text-[10px] font-semibold rounded border uppercase tracking-wider ${
                  colorMap === 'amber'
                    ? 'bg-amber-600 text-white border-amber-500'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                Amber
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
