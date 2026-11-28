import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SnowBlower } from '@/components/seasonal/snow-blower';
import { SnowGameHud } from '@/components/seasonal/snow-game-hud';
import {
    CarriedShovel,
    SHOVEL_GRIP,
    SnowShovel,
} from '@/components/seasonal/snow-shovel';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useStoredValue, writeStoredValue } from '@/hooks/use-stored-value';
import { SNOW_BLOWER, SNOW_SHOVEL } from '@/lib/snow/geometry';
import { snowHost } from '@/lib/snow/host';
import type { SnowTool } from '@/lib/snow/protocol';
import { cn } from '@/lib/utils';

const BEST_TIME_KEY = 'snowman-best-time';
const BLOWER_SPEED = 175;

const isTyping = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    (target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * December's snow: drawn by a worker on a canvas behind dialogs (`@/lib/snow`), fading in when the
 * worker is ready. On devices with a mouse the snow settles at the bottom, and the shovel and the
 * snowblower parked in the corner move it; snow thrown onto the outline builds a snowman, on time.
 */
export default function SnowScene() {
    const host = snowHost();
    const { backend, game } = useSyncExternalStore(
        host.subscribe,
        host.getStatus,
        host.getStatus,
    );
    const interactive = useMediaQuery('(hover: hover) and (pointer: fine)');
    const container = useRef<HTMLDivElement>(null);
    const carried = useRef<HTMLDivElement>(null);
    const blowerButton = useRef<HTMLButtonElement>(null);
    const [picked, setTool] = useState<SnowTool>(null);
    const canPlay = interactive && backend !== null;
    const tool = canPlay ? picked : null;
    const best = Number(useStoredValue(BEST_TIME_KEY)) || null;
    // The record as it was when this snowman was finished, to tell a new one from an old one.
    const [beaten, setBeaten] = useState<{ record: boolean } | null>(null);

    useEffect(() => {
        if (!container.current) {
            return;
        }

        return host.mount(container.current, interactive);
        // The pointer type is passed on below; it should not remount the canvas.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [host]);

    useEffect(() => {
        host.setInteractive(interactive);
    }, [host, interactive]);

    useEffect(() => {
        host.setTool(tool);
    }, [host, tool]);

    if (game.phase === 'done' && beaten === null) {
        const record = best === null || game.elapsedMs < best;
        setBeaten({ record });
    } else if (game.phase !== 'done' && beaten !== null) {
        setBeaten(null);
    }
    useEffect(() => {
        if (beaten?.record) {
            writeStoredValue(BEST_TIME_KEY, String(game.elapsedMs));
        }
        // Saved once, when the snowman is finished.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [beaten]);

    // Moving the mouse stirs the falling snow. With the shovel in hand, it hangs from the pointer and
    // swings behind it, and the edge of its blade is what digs.
    useEffect(() => {
        if (!canPlay) {
            return;
        }
        const shovelling = tool === 'shovel';
        const shovel = carried.current;
        let pointerX = 0;
        let pointerY = 0;
        let seen = false;
        let angle = 0;
        let swing = 0;
        let speed = 0;
        let lastX = 0;
        let last = performance.now();
        let frame = 0;

        const onMove = (event: PointerEvent) => {
            pointerX = event.clientX;
            pointerY = event.clientY;
            seen = true;
            if (!shovelling) {
                host.pointer(pointerX, pointerY);
            }
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setTool(null);
            }
        };
        const swingShovel = (now: number) => {
            frame = window.requestAnimationFrame(swingShovel);
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            if (!seen || !shovel || dt <= 0) {
                return;
            }
            speed += ((pointerX - lastX) / dt - speed) * Math.min(1, dt * 14);
            lastX = pointerX;
            // A damped spring towards an angle that trails the movement.
            const rest = Math.max(-0.75, Math.min(0.75, speed * 0.0011));
            swing += ((rest - angle) * 130 - swing * 15) * dt;
            angle += swing * dt;

            const edgeX = pointerX - Math.sin(angle) * SNOW_SHOVEL.length;
            const edgeY = Math.min(
                window.innerHeight - 1,
                pointerY + Math.cos(angle) * SNOW_SHOVEL.length,
            );
            shovel.style.opacity = '1';
            shovel.style.transform = `translate(${pointerX - SHOVEL_GRIP.x}px, ${pointerY - SHOVEL_GRIP.y}px) rotate(${angle}rad)`;
            host.pointer(edgeX, edgeY);
        };

        window.addEventListener('pointermove', onMove, { passive: true });
        if (shovelling) {
            document.documentElement.classList.add('is-shovelling');
            window.addEventListener('keydown', onKey);
            frame = window.requestAnimationFrame(swingShovel);
        }

        return () => {
            window.cancelAnimationFrame(frame);
            document.documentElement.classList.remove('is-shovelling');
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('keydown', onKey);
            if (shovel) {
                shovel.style.opacity = '0';
            }
        };
    }, [host, canPlay, tool]);

    // Drive the snowblower with the arrow keys. They are taken before the page's own shortcuts
    // (e.g. previous/next week), except while typing in a field.
    useEffect(() => {
        const button = blowerButton.current;
        if (tool !== 'blower' || !button) {
            return;
        }
        const keys = { left: false, right: false, up: false, down: false };
        let x = button.getBoundingClientRect().left;
        let speed = 0;
        let direction: 1 | -1 = -1;
        let elevation: number = SNOW_BLOWER.defaultElevation;
        let last = performance.now();
        let frame = 0;
        // The keys are read from the window, so the button needs no focus (and no focus ring while driving).
        button.blur();

        const held = (key: string): keyof typeof keys | null =>
            key === 'ArrowLeft'
                ? 'left'
                : key === 'ArrowRight'
                  ? 'right'
                  : key === 'ArrowUp'
                    ? 'up'
                    : key === 'ArrowDown'
                      ? 'down'
                      : null;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setTool(null);

                return;
            }
            const key = held(event.key);
            if (!key || isTyping(event.target)) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            keys[key] = true;
        };
        const onKeyUp = (event: KeyboardEvent) => {
            const key = held(event.key);
            if (key) {
                keys[key] = false;
            }
        };
        const release = () => {
            keys.left = keys.right = keys.up = keys.down = false;
        };
        const drive = (now: number) => {
            frame = window.requestAnimationFrame(drive);
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            const move = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
            if (move !== 0) {
                direction = move > 0 ? 1 : -1;
            }
            // It takes a moment to get going and to stop.
            const change = move * BLOWER_SPEED - speed;
            speed += Math.max(-700 * dt, Math.min(700 * dt, change));
            const limit = window.innerWidth - SNOW_BLOWER.width;
            x = Math.max(0, Math.min(limit, x + speed * dt));
            if (x === 0 || x === limit) {
                speed = 0;
            }
            elevation = Math.max(
                SNOW_BLOWER.minElevation,
                Math.min(
                    SNOW_BLOWER.maxElevation,
                    elevation +
                        ((keys.up ? 1 : 0) - (keys.down ? 1 : 0)) * 0.9 * dt,
                ),
            );

            button.style.left = `${x}px`;
            button.style.right = 'auto';
            button.style.setProperty('--facing', String(direction));
            button.style.setProperty(
                '--wheel',
                `${(direction * x * 180) / (Math.PI * 13)}deg`,
            );
            button.style.setProperty(
                '--chute',
                `${(elevation * 180) / Math.PI - 90}deg`,
            );
            host.blower({ x, direction, elevation, speed });
        };

        window.addEventListener('keydown', onKeyDown, { capture: true });
        window.addEventListener('keyup', onKeyUp, { capture: true });
        window.addEventListener('blur', release);
        frame = window.requestAnimationFrame(drive);

        return () => {
            window.cancelAnimationFrame(frame);
            for (const property of [
                'left',
                'right',
                '--facing',
                '--chute',
                '--wheel',
            ]) {
                button.style.removeProperty(property);
            }
            window.removeEventListener('keydown', onKeyDown, { capture: true });
            window.removeEventListener('keyup', onKeyUp, { capture: true });
            window.removeEventListener('blur', release);
        };
    }, [host, tool]);

    return (
        <>
            <div
                ref={container}
                className={cn(
                    'pointer-events-none fixed inset-0 z-40 transition-opacity duration-[1500ms] ease-out',
                    backend === null ? 'opacity-0' : 'opacity-100',
                )}
                data-test="seasonal-effects"
                data-backend={backend ?? undefined}
            />
            {canPlay && (
                <>
                    {tool !== null && (
                        <SnowGameHud
                            tool={tool}
                            game={game}
                            bestMs={best}
                            isRecord={beaten?.record ?? false}
                            onRebuild={() => host.rebuild()}
                        />
                    )}
                    <SnowBlower
                        isDriving={tool === 'blower'}
                        onChange={(isDriving) =>
                            setTool(isDriving ? 'blower' : null)
                        }
                        buttonRef={blowerButton}
                    />
                    <SnowShovel
                        isShovelling={tool === 'shovel'}
                        onChange={(isShovelling) =>
                            setTool(isShovelling ? 'shovel' : null)
                        }
                    />
                    <CarriedShovel ref={carried} />
                </>
            )}
        </>
    );
}
