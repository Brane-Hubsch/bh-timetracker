import { useEffect, useRef } from 'react';

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

/**
 * New Year's fireworks on a canvas behind dialogs. It never takes clicks and pauses while the tab is
 * hidden.
 */
export function Fireworks() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) {
            return;
        }

        let width = 0;
        let height = 0;
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
    }, []);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-40 size-full"
            data-test="fireworks"
        />
    );
}
