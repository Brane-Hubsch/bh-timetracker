import { useEffect, useRef, useState } from 'react';
import {
    seasonalEffectsOn,
    useSeasonalEffectsEnabled,
} from '@/lib/seasonal-effects';
import type { SeasonalEffects as Effects } from '@/lib/seasonal-effects';
import { SnowDrift } from '@/lib/snow-drift';
import {
    SNOW_BLOWER_CHUTE,
    SNOW_BLOWER_HEIGHT,
    SNOW_BLOWER_WIDTH,
    SnowBlower,
    SnowBlowerHint,
} from '@/components/snow-blower';
import { SnowShovel } from '@/components/snow-shovel';

type Flake = {
    x: number;
    y: number;
    /** 0 is far away (small, slow, faint), 1 is close to the viewer. */
    depth: number;
    radius: number;
    speed: number;
    opacity: number;
    sway: number;
    swaySpeed: number;
    phase: number;
};

const SPRITE_SIZE = 64;

/**
 * A soft, round flake drawn once and reused.
 */
function flakeSprite(isDark: boolean): HTMLCanvasElement {
    const sprite = document.createElement('canvas');
    sprite.width = SPRITE_SIZE;
    sprite.height = SPRITE_SIZE;
    const context = sprite.getContext('2d');
    if (!context) {
        return sprite;
    }
    const center = SPRITE_SIZE / 2;

    // White snow on a dark background; on light backgrounds white would vanish, so the flakes are a soft,
    // cold blue-grey there instead.
    const color = isDark ? '255, 255, 255' : '100, 116, 139';
    const flake = context.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        center * 0.62,
    );
    flake.addColorStop(0, `rgba(${color}, ${isDark ? 1 : 0.75})`);
    flake.addColorStop(0.45, `rgba(${color}, ${isDark ? 0.85 : 0.55})`);
    flake.addColorStop(1, `rgba(${color}, 0)`);
    context.fillStyle = flake;
    context.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

    return sprite;
}

function createFlake(
    width: number,
    height: number,
    anywhere: boolean,
    // Most flakes are far away; a few large ones drift close to the viewer.
    depth = Math.random() ** 1.8,
): Flake {
    return {
        x: Math.random() * width,
        y: anywhere ? Math.random() * height : -10,
        depth,
        radius: 0.7 + depth * depth * 4.3 + Math.random() * 0.5,
        speed: 0.25 + depth * 1.35 + Math.random() * 0.2,
        opacity: 0.35 + depth * 0.6,
        sway: 0.2 + depth * 0.9 + Math.random() * 0.4,
        swaySpeed: 0.006 + Math.random() * 0.018,
        phase: Math.random() * Math.PI * 2,
    };
}
type Spark = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    alpha: number;
    color: string;
};
type Rocket = {
    x: number;
    y: number;
    vy: number;
    targetY: number;
    color: string;
};

const FIREWORK_COLORS = [
    '#ff5a5f',
    '#ffd166',
    '#06d6a0',
    '#4cc9f0',
    '#c77dff',
    '#ff8fab',
    '#ffffff',
];

function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(
        () =>
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );

    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = () => setReduced(query.matches);
        query.addEventListener('change', onChange);

        return () => query.removeEventListener('change', onChange);
    }, []);

    return reduced;
}

/** Only devices with a mouse get the snow drift and the shovel. */
function useFinePointer(): boolean {
    const [fine, setFine] = useState(
        () =>
            typeof window !== 'undefined' &&
            window.matchMedia('(hover: hover) and (pointer: fine)').matches,
    );

    useEffect(() => {
        const query = window.matchMedia('(hover: hover) and (pointer: fine)');
        const onChange = () => setFine(query.matches);
        query.addEventListener('change', onChange);

        return () => query.removeEventListener('change', onChange);
    }, []);

    return fine;
}

/** Re-check the date every hour, so the effects start and stop around midnight. */
function useSeason(): Effects {
    const [season, setSeason] = useState(() => seasonalEffectsOn(new Date()));

    useEffect(() => {
        const timer = window.setInterval(
            () => setSeason(seasonalEffectsOn(new Date())),
            60 * 60 * 1000,
        );

        return () => window.clearInterval(timer);
    }, []);

    return season;
}

/**
 * Decorative snow and fireworks on a canvas behind dialogs. It never takes clicks, pauses while the tab is
 * hidden and is not shown when the device asks for reduced motion. On devices with a mouse the snow
 * settles at the bottom, and the shovel in the corner clears it.
 */
export function SeasonalEffects() {
    const enabled = useSeasonalEffectsEnabled();
    const reducedMotion = useReducedMotion();
    const { snow, fireworks } = useSeason();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const active = enabled && !reducedMotion && (snow || fireworks);
    const canShovel = useFinePointer();
    const hasDrift = active && snow && canShovel;
    const [drift] = useState(() => new SnowDrift());
    const [tool, setTool] = useState<'shovel' | 'blower' | null>(null);
    const shovelling = tool === 'shovel' && hasDrift;
    const driving = tool === 'blower' && hasDrift;
    const blowerButton = useRef<HTMLButtonElement>(null);
    const blower = useRef({
        driving: false,
        x: 0,
        direction: -1 as 1 | -1,
        left: false,
        right: false,
    });

    useEffect(() => {
        if (!shovelling) {
            return;
        }
        const root = document.documentElement;
        root.classList.add('is-shovelling');
        let lastX: number | null = null;

        const onMove = (event: PointerEvent) => {
            const dx = lastX === null ? 0 : event.clientX - lastX;
            lastX = event.clientX;
            drift.shovel(event.clientX, event.clientY, dx, window.innerHeight);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setTool(null);
            }
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('keydown', onKey);

        return () => {
            root.classList.remove('is-shovelling');
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('keydown', onKey);
        };
    }, [shovelling, drift]);

    // Drive the snowblower with the arrow keys. They are taken before the page's own shortcuts
    // (e.g. previous/next week), except while typing in a field.
    useEffect(() => {
        const button = blowerButton.current;
        if (!driving || !button) {
            return;
        }
        const state = blower.current;
        state.x = button.getBoundingClientRect().left;
        // The keys are read from the window, so the button needs no focus (and no focus ring while driving).
        button.blur();
        state.direction = -1;
        state.driving = true;

        const isTyping = (target: EventTarget | null) =>
            target instanceof HTMLElement &&
            (target.isContentEditable ||
                ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setTool(null);
                return;
            }
            if (!event.key.startsWith('Arrow') || isTyping(event.target)) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (event.key === 'ArrowLeft') {
                state.left = true;
            } else if (event.key === 'ArrowRight') {
                state.right = true;
            }
        };
        const onKeyUp = (event: KeyboardEvent) => {
            if (event.key === 'ArrowLeft') {
                state.left = false;
            } else if (event.key === 'ArrowRight') {
                state.right = false;
            }
        };
        const onBlur = () => {
            state.left = false;
            state.right = false;
        };
        window.addEventListener('keydown', onKeyDown, { capture: true });
        window.addEventListener('keyup', onKeyUp, { capture: true });
        window.addEventListener('blur', onBlur);

        return () => {
            state.driving = false;
            onBlur();
            button.style.removeProperty('left');
            button.style.removeProperty('right');
            button.style.removeProperty('--facing');
            window.removeEventListener('keydown', onKeyDown, { capture: true });
            window.removeEventListener('keyup', onKeyUp, { capture: true });
            window.removeEventListener('blur', onBlur);
        };
    }, [driving]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');

        if (!active || !canvas || !context) {
            return;
        }

        let width = 0;
        let height = 0;
        let flakes: Flake[] = [];
        let spriteIsDark = document.documentElement.classList.contains('dark');
        let sprite = flakeSprite(spriteIsDark);
        const sparks: Spark[] = [];
        const rockets: Rocket[] = [];
        let nextRocketAt = 0;
        let frame = 0;
        let last = performance.now();

        const resize = () => {
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = Math.round(width * ratio);
            canvas.height = Math.round(height * ratio);
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            drift.resize(width);

            if (snow) {
                const count = Math.min(
                    200,
                    Math.round((width * height) / 8000),
                );
                // Far flakes first, so the near ones are drawn on top.
                flakes = Array.from({ length: count }, () =>
                    createFlake(width, height, true),
                ).sort((a, b) => a.depth - b.depth);
            }
        };

        const launch = (now: number) => {
            rockets.push({
                x: width * (0.15 + Math.random() * 0.7),
                y: height,
                vy: -(7 + Math.random() * 3),
                targetY: height * (0.12 + Math.random() * 0.3),
                color: FIREWORK_COLORS[
                    Math.floor(Math.random() * FIREWORK_COLORS.length)
                ],
            });
            nextRocketAt = now + 700 + Math.random() * 1600;
        };

        const explode = (rocket: Rocket) => {
            const count = 50 + Math.floor(Math.random() * 30);
            for (let index = 0; index < count; index++) {
                const angle = (index / count) * Math.PI * 2;
                const speed = 1.5 + Math.random() * 3;
                sparks.push({
                    x: rocket.x,
                    y: rocket.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    alpha: 1,
                    color: Math.random() < 0.25 ? '#ffffff' : rocket.color,
                });
            }
        };

        const draw = (now: number) => {
            // Steps of one 60 Hz frame, so the speed is the same on every display.
            const step = Math.min((now - last) / 16.67, 3);
            last = now;
            const isDark = document.documentElement.classList.contains('dark');
            context.clearRect(0, 0, width, height);

            if (snow) {
                if (isDark !== spriteIsDark) {
                    sprite = flakeSprite(isDark);
                    spriteIsDark = isDark;
                }
                // A slow breeze with gusts; near flakes are pushed more than far ones.
                const wind =
                    Math.sin(now * 0.00017) * 0.5 +
                    Math.sin(now * 0.00063 + 1.3) * 0.35 +
                    Math.sin(now * 0.0021) * 0.1;

                for (const flake of flakes) {
                    flake.phase += flake.swaySpeed * step;
                    flake.y += flake.speed * step;
                    flake.x +=
                        (Math.sin(flake.phase) * flake.sway * 0.5 +
                            wind * (0.3 + flake.depth)) *
                        step;

                    const margin = flake.radius * 3;
                    if (
                        hasDrift &&
                        flake.y >= height - drift.depthAt(flake.x)
                    ) {
                        drift.land(flake.x, flake.radius);
                        Object.assign(
                            flake,
                            createFlake(width, height, false, flake.depth),
                        );
                    } else if (flake.y - margin > height) {
                        Object.assign(
                            flake,
                            createFlake(width, height, false, flake.depth),
                        );
                    }
                    if (flake.x < -margin) {
                        flake.x = width + margin;
                    } else if (flake.x > width + margin) {
                        flake.x = -margin;
                    }

                    const size = flake.radius * 3.2;
                    context.globalAlpha = flake.opacity;
                    context.drawImage(
                        sprite,
                        flake.x - size / 2,
                        flake.y - size / 2,
                        size,
                        size,
                    );
                }
                context.globalAlpha = 1;

                const state = blower.current;
                const button = blowerButton.current;
                if (hasDrift && state.driving && button) {
                    const move = (state.right ? 1 : 0) - (state.left ? 1 : 0);
                    if (move !== 0) {
                        state.direction = move > 0 ? 1 : -1;
                    }
                    state.x = Math.max(
                        0,
                        Math.min(
                            width - SNOW_BLOWER_WIDTH,
                            state.x + move * 2.5 * step,
                        ),
                    );
                    button.style.left = `${state.x}px`;
                    button.style.right = 'auto';
                    button.style.setProperty(
                        '--facing',
                        String(state.direction),
                    );

                    const facingRight = state.direction === 1;
                    drift.blow(
                        facingRight ? state.x + SNOW_BLOWER_WIDTH : state.x,
                        state.direction,
                        facingRight
                            ? state.x + SNOW_BLOWER_CHUTE.x
                            : state.x + SNOW_BLOWER_WIDTH - SNOW_BLOWER_CHUTE.x,
                        height - SNOW_BLOWER_HEIGHT + SNOW_BLOWER_CHUTE.y,
                    );
                }

                if (hasDrift) {
                    drift.update(step, width, height);
                    drift.draw(context, width, height, isDark);
                }
            }

            if (fireworks) {
                if (now >= nextRocketAt) {
                    launch(now);
                }
                context.globalCompositeOperation = isDark
                    ? 'lighter'
                    : 'source-over';

                for (let index = rockets.length - 1; index >= 0; index--) {
                    const rocket = rockets[index];
                    rocket.y += rocket.vy * step;
                    rocket.vy += 0.08 * step;
                    context.strokeStyle = rocket.color;
                    context.lineWidth = 2;
                    context.beginPath();
                    context.moveTo(rocket.x, rocket.y);
                    context.lineTo(rocket.x, rocket.y - rocket.vy * 3);
                    context.stroke();
                    if (rocket.y <= rocket.targetY || rocket.vy >= -1) {
                        explode(rocket);
                        rockets.splice(index, 1);
                    }
                }

                for (let index = sparks.length - 1; index >= 0; index--) {
                    const spark = sparks[index];
                    spark.vx *= 0.985 ** step;
                    spark.vy = spark.vy * 0.985 ** step + 0.04 * step;
                    spark.x += spark.vx * step;
                    spark.y += spark.vy * step;
                    spark.alpha -= 0.012 * step;
                    if (spark.alpha <= 0) {
                        sparks.splice(index, 1);
                        continue;
                    }
                    context.globalAlpha = spark.alpha;
                    context.fillStyle = spark.color;
                    context.fillRect(spark.x - 1.5, spark.y - 1.5, 3, 3);
                }
                context.globalAlpha = 1;
                context.globalCompositeOperation = 'source-over';
            }

            frame = window.requestAnimationFrame(draw);
        };

        const start = () => {
            window.cancelAnimationFrame(frame);
            last = performance.now();
            frame = window.requestAnimationFrame(draw);
        };
        const onVisibility = () => {
            if (document.hidden) {
                window.cancelAnimationFrame(frame);
            } else {
                start();
            }
        };

        resize();
        start();
        window.addEventListener('resize', resize);
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('resize', resize);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [active, snow, fireworks, hasDrift, drift]);

    if (!active) {
        return null;
    }

    return (
        <>
            <canvas
                ref={canvasRef}
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 z-40 size-full"
                data-test="seasonal-effects"
            />
            {hasDrift && (
                <>
                    {driving && <SnowBlowerHint />}
                    <SnowBlower
                        isDriving={driving}
                        onChange={(isDriving) =>
                            setTool(isDriving ? 'blower' : null)
                        }
                        buttonRef={blowerButton}
                    />
                    <SnowShovel
                        isShovelling={shovelling}
                        onChange={(isShovelling) =>
                            setTool(isShovelling ? 'shovel' : null)
                        }
                    />
                </>
            )}
        </>
    );
}
