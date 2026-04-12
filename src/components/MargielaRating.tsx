import { cn } from '../lib/utils';
import { sfx } from '../lib/sounds';

interface Props {
  rating: number;
  size?: 'sm' | 'lg';
  accentColor?: string;   // circle + active number color
  dimColor?: string;      // inactive number color
  interactive?: boolean;  // if true, numbers are clickable
  onChange?: (v: number) => void;
}

export function MargielaRating({
  rating,
  size = 'sm',
  accentColor = '#C24127',
  dimColor = 'rgba(107,106,101,0.35)',
  interactive = false,
  onChange,
}: Props) {
  const isLg = size === 'lg';

  return (
    <div className={cn("flex items-center flex-wrap", isLg ? "gap-1" : "gap-0.5")}>
      {Array.from({ length: 11 }, (_, i) => {
        const isActive = i === rating;
        return (
          <span
            key={i}
            onClick={interactive && onChange ? (e) => { e.stopPropagation(); sfx.ratingClick(); onChange(i); } : undefined}
            className={cn(
              "inline-flex items-center justify-center leading-none relative font-tag select-none",
              isLg ? "w-9 h-9 text-[15px]" : "w-[19px] h-[19px] text-[9px]",
              interactive ? "cursor-pointer hover:opacity-80 transition-opacity" : "",
              isActive ? "font-bold" : ""
            )}
            style={{
              color: isActive ? accentColor : dimColor,
            }}
          >
            {i}
            {isActive && (
              <span
                className="absolute inset-0"
                style={{
                  border: `${isLg ? 2 : 1.5}px solid ${accentColor}`,
                  borderRadius: '50% 48% 54% 50% / 52% 50% 48% 54%',
                  transform: 'rotate(-4deg) scale(1.08)',
                }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
