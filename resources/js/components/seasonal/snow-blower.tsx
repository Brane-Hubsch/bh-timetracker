import { Button } from '@heroui/react';
import { useId } from 'react';
import type { CSSProperties, Ref } from 'react';
import { useTranslation } from '@/lib/i18n';
import { SNOW_BLOWER } from '@/lib/snow/geometry';
import { cn } from '@/lib/utils';

const { width, height, chutePivot, chuteLength } = SNOW_BLOWER;
const WHEEL = { x: 31, y: height - 13, radius: 13 };
const pivot = (x: number, y: number): CSSProperties => ({
    transformBox: 'view-box',
    transformOrigin: `${x}px ${y}px`,
});

/**
 * A two-stage snowblower seen from the side, facing right. The snow scene's loop sets the custom
 * properties while it is driven: --facing (1 or -1), --wheel and --chute (degrees).
 */
function SnowBlowerDrawing({ isDriving }: { isDriving: boolean }) {
    const id = useId();

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            fill="none"
            aria-hidden="true"
            className="overflow-visible"
            style={{
                width,
                height,
                transform: 'scaleX(var(--facing, -1))',
            }}
        >
            <defs>
                <linearGradient id={`${id}-body`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#f87171" />
                    <stop offset="0.5" stopColor="#dc2626" />
                    <stop offset="1" stopColor="#991b1b" />
                </linearGradient>
                <linearGradient
                    id={`${id}-housing`}
                    x1="0"
                    x2="1"
                    y1="0"
                    y2="1"
                >
                    <stop offset="0" stopColor="#ef4444" />
                    <stop offset="1" stopColor="#7f1d1d" />
                </linearGradient>
                <linearGradient id={`${id}-steel`} x1="0" x2="1">
                    <stop offset="0" stopColor="#1f2937" />
                    <stop offset="0.5" stopColor="#6b7280" />
                    <stop offset="1" stopColor="#111827" />
                </linearGradient>
                <radialGradient id={`${id}-hub`}>
                    <stop offset="0" stopColor="#f1f5f9" />
                    <stop offset="1" stopColor="#94a3b8" />
                </radialGradient>
                <clipPath id={`${id}-mouth`}>
                    <path d="M68 37q0-5 6-5h14q9 3 9 14v17H72q-4 0-4-4Z" />
                </clipPath>
            </defs>

            {/* Handlebars with the controls. */}
            <path
                d="M24 34 7 7M30 36 14 9"
                stroke="#1f2937"
                strokeWidth="2.6"
                strokeLinecap="round"
            />
            <path
                d="M2 7.5h14"
                stroke="#111827"
                strokeWidth="4.4"
                strokeLinecap="round"
            />
            <path
                d="M13 13.5 21 10"
                stroke="#dc2626"
                strokeWidth="1.6"
                strokeLinecap="round"
            />

            {/* The chute turns around its collar. */}
            <g
                style={{
                    ...pivot(chutePivot.x, chutePivot.y),
                    transform: 'rotate(var(--chute, -36deg))',
                }}
            >
                <path
                    d={`M${chutePivot.x - 5} ${chutePivot.y + 2}l1-${chuteLength - 3}q0-4 4-4t4 4l1 ${chuteLength - 3}Z`}
                    fill={`url(#${id}-steel)`}
                    stroke="#030712"
                    strokeWidth="0.8"
                />
                <path
                    d={`M${chutePivot.x - 5.5} ${chutePivot.y - chuteLength + 6}h11`}
                    stroke="#9ca3af"
                    strokeWidth="1"
                />
            </g>
            <rect
                x={chutePivot.x - 7.5}
                y={chutePivot.y - 2}
                width="15"
                height="6"
                rx="2"
                fill="#374151"
                stroke="#030712"
                strokeWidth="0.8"
            />

            <g className={cn(isDriving && 'snow-blower-running')}>
                {/* Engine and tank. */}
                <rect
                    x="22"
                    y="16"
                    width="20"
                    height="9"
                    rx="3"
                    fill="#1f2937"
                />
                <rect
                    x="27"
                    y="13"
                    width="6"
                    height="4"
                    rx="1"
                    fill="#facc15"
                />
                <path
                    d="M17 30q0-7 7-7h34q5 0 5 5v22H17Z"
                    fill={`url(#${id}-body)`}
                    stroke="#7f1d1d"
                    strokeWidth="1"
                />
                <path
                    d="M23 31h14M23 35h14M23 39h14"
                    stroke="#7f1d1d"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                />
                <rect
                    x="42"
                    y="29"
                    width="16"
                    height="5"
                    rx="1.5"
                    fill="#fde68a"
                    fillOpacity="0.9"
                />
                <circle
                    cx="63"
                    cy="33"
                    r="3.2"
                    fill="#fef9c3"
                    stroke="#a16207"
                    strokeWidth="0.9"
                />

                {/* The auger housing, open towards the snow. */}
                <path
                    d="M58 30q0-6 7-6h22q11 4 11 18v21l-5 4H64q-6 0-6-6Z"
                    fill={`url(#${id}-housing)`}
                    stroke="#450a0a"
                    strokeWidth="1"
                />
                <g clipPath={`url(#${id}-mouth)`}>
                    <rect x="66" y="30" width="34" height="36" fill="#1c1917" />
                    <g className={cn(isDriving && 'snow-blower-auger')}>
                        {[-12, 0, 12, 24, 36].map((offset) => (
                            <path
                                key={offset}
                                d={`M${62 + offset} 66 ${70 + offset} 32h5l-8 34Z`}
                                fill="#cbd5e1"
                                stroke="#64748b"
                                strokeWidth="0.7"
                            />
                        ))}
                    </g>
                    <rect
                        x="66"
                        y="47"
                        width="34"
                        height="3.5"
                        fill="#475569"
                    />
                </g>
                <path
                    d="M88 67h10"
                    stroke="#111827"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                />
            </g>

            {/* The wheel turns with the distance driven. */}
            <g
                style={{
                    ...pivot(WHEEL.x, WHEEL.y),
                    transform: 'rotate(var(--wheel, 0deg))',
                }}
            >
                <circle
                    cx={WHEEL.x}
                    cy={WHEEL.y}
                    r={WHEEL.radius - 1.5}
                    fill="#111827"
                    stroke="#030712"
                    strokeWidth="3"
                    strokeDasharray="3.2 2.2"
                />
                <circle
                    cx={WHEEL.x}
                    cy={WHEEL.y}
                    r="6"
                    fill={`url(#${id}-hub)`}
                    stroke="#475569"
                />
                <path
                    d={`M${WHEEL.x - 5} ${WHEEL.y}h10M${WHEEL.x} ${WHEEL.y - 5}v10`}
                    stroke="#475569"
                    strokeWidth="1.4"
                />
            </g>
        </svg>
    );
}

export function SnowBlower({
    isDriving,
    onChange,
    buttonRef,
}: {
    isDriving: boolean;
    onChange: (isDriving: boolean) => void;
    buttonRef: Ref<HTMLButtonElement>;
}) {
    const { t } = useTranslation();
    const label = isDriving
        ? t('Park the snowblower')
        : t('Drive the snowblower with the arrow keys');

    return (
        <Button
            ref={buttonRef}
            variant="ghost"
            aria-label={label}
            aria-pressed={isDriving}
            onPress={() => onChange(!isDriving)}
            className={cn(
                // The parked spot; while driving, inline left/right from the loop take over.
                'fixed right-16 bottom-0 z-40 h-auto w-auto min-w-0 animate-enter rounded-md bg-transparent p-0 drop-shadow-sm hover:bg-transparent',
                !isDriving &&
                    'transition-transform duration-200 hover:-translate-y-0.5',
            )}
            data-test="snow-blower"
        >
            <SnowBlowerDrawing isDriving={isDriving} />
        </Button>
    );
}
