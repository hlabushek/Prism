import React from 'react';

interface PrismLogoProps {
  className?: string;
  showText?: boolean;
}

export const PrismLogo: React.FC<PrismLogoProps> = ({
  className = '',
  showText = true,
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Light Theme Logo */}
      <img
        src="/logo_light.png"
        alt="Prism News"
        className="block dark:hidden h-9 sm:h-11 w-auto object-contain transition-transform duration-200 hover:scale-105"
        loading="eager"
      />
      {/* Dark Theme Logo */}
      <img
        src="/logo_dark.png"
        alt="Prism News"
        className="hidden dark:block h-9 sm:h-11 w-auto object-contain transition-transform duration-200 hover:scale-105"
        loading="eager"
      />

      {showText && (
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-black text-lg sm:text-xl tracking-tight text-slate-900 dark:text-white font-sans">
              Prism News
            </span>
            <span className="text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#1969ae]/15 text-[#1969ae] dark:text-sky-300 border border-[#1969ae]/30">
              AI
            </span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide mt-0.5">
            Multi-Vector Intelligence
          </span>
        </div>
      )}
    </div>
  );
};
