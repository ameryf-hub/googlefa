import React, { useState } from 'react';

interface CompareSliderProps {
  original: string;
  edited: string;
  className?: string;
}

export default function CompareSlider({ original, edited, className = '' }: CompareSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderPosition(Number(e.target.value));
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 select-none ${className}`}>
      {/* Original Image (drawn on the right/entire container) */}
      <img
        src={original}
        alt="Original Product"
        className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
        referrerPolicy="no-referrer"
      />

      {/* Edited Image (clipped based on slider position, showing on the left) */}
      <div
        className="absolute top-0 left-0 w-full h-full overflow-hidden"
        style={{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }}
      >
        <img
          src={edited}
          alt="Edited Product"
          className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
          style={{ width: '100%', height: '100%' }}
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Labels for Before / After */}
      <div className="absolute top-3 left-3 bg-neutral-900/80 backdrop-blur-xs text-white text-[10px] uppercase font-semibold font-mono px-2 py-1 rounded tracking-wide pointer-events-none z-10">
        Original
      </div>
      <div className="absolute top-3 right-3 bg-indigo-600/90 backdrop-blur-xs text-white text-[10px] uppercase font-semibold font-mono px-2 py-1 rounded tracking-wide pointer-events-none z-10">
        Polished
      </div>

      {/* Vertical divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-xl pointer-events-none z-20"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-2 border-indigo-500 shadow-md flex items-center justify-center cursor-ew-resize">
          <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 9l4-4 4 4m0 6l-4 4-4-4" style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }} />
          </svg>
        </div>
      </div>

      {/* Hidden input range spanning the entire width */}
      <input
        type="range"
        min="0"
        max="100"
        value={sliderPosition}
        onChange={handleSliderChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
      />
    </div>
  );
}
