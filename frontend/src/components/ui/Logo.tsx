type LogoProps = {
  size?: number; // mark height in px (mark is 1:2, width = size / 2)
  withWordmark?: boolean;
  className?: string;
};

export default function Logo({
  size = 28,
  withWordmark = false,
  className = "",
}: LogoProps) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size / 2}
        height={size}
        viewBox="0 0 40 80"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
        aria-hidden
        className="shrink-0"
      >
        <path d="M20 3V27" stroke="white" strokeWidth="5" />
        <path
          d="M8 27H32V59L20 47L8 59V27Z"
          stroke="white"
          strokeWidth="5"
          strokeLinejoin="miter"
        />
        <path d="M20 47V77" stroke="white" strokeWidth="5" />
      </svg>
      {withWordmark && (
        <span className="text-[22px] font-bold leading-none tracking-tight text-white">
          mnemo
        </span>
      )}
    </span>
  );
}
