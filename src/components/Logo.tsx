export function Logo({ className = '', darkText = false }: { className?: string, darkText?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 48 48" className="w-9 h-9 shrink-0 drop-shadow-[0_0_10px_rgba(29,158,117,0.3)]" fill="none">
        <path d="M8 22L24 8L40 22V40C40 41.1 39.1 42 38 42H10C8.9 42 8 41.1 8 40V22Z" fill="#1D9E75"/>
        <path d="M4 24L24 6L44 24" stroke="#1D9E75" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="20" y="30" width="8" height="12" rx="1" fill="#16795A"/>
        <circle cx="34" cy="14" r="8" fill="#1D9E75" stroke="white" strokeWidth="2.5"/>
        <path d="M30.5 14L33 16.5L37.5 11.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div className="flex flex-col leading-none text-left">
        <span className={`font-bold text-xl tracking-tight ${darkText ? 'text-deep-forest' : 'text-white'}`}>Wayside</span>
        <span className="font-bold text-[9px] text-pathway-green tracking-[0.25em] uppercase">Services</span>
      </div>
    </div>
  );
}
