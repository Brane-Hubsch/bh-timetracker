import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export function ShortcutRow({
    children,
    contentClassName,
    label,
    'data-test': dataTest,
}: {
    children: ReactNode;
    contentClassName?: string;
    label?: string;
    'data-test'?: string;
}) {
    const viewport = useRef<HTMLDivElement>(null);
    const row = useRef<HTMLDivElement>(null);
    const [fadeLeft, setFadeLeft] = useState(false);
    const [fadeRight, setFadeRight] = useState(false);

    useEffect(() => {
        const element = viewport.current;
        const content = row.current;

        if (!element || !content) {
            return;
        }

        const updateFades = () => {
            const { scrollLeft, scrollWidth, clientWidth } = element;
            setFadeLeft(scrollLeft > 1);
            setFadeRight(scrollWidth - clientWidth - scrollLeft > 1);
        };

        const observer = new ResizeObserver(updateFades);
        observer.observe(element);
        observer.observe(content);
        element.addEventListener('scroll', updateFades, { passive: true });

        return () => {
            observer.disconnect();
            element.removeEventListener('scroll', updateFades);
        };
    }, []);

    const leftFadeWidth = fadeLeft ? '1.5rem' : '0px';
    const rightFadeWidth = fadeRight ? '1.5rem' : '0px';

    return (
        <div
            // Keep the fade on a stationary layer outside the touch scroller.
            className="min-w-0"
            style={{
                maskImage:
                    fadeLeft || fadeRight
                        ? `linear-gradient(to right, transparent, black ${leftFadeWidth}, black calc(100% - ${rightFadeWidth}), transparent)`
                        : undefined,
            }}
        >
            <div
                ref={viewport}
                role={label ? 'group' : undefined}
                aria-label={label}
                className="scroll-px-6 [scrollbar-width:none] overflow-x-auto"
                data-test={dataTest}
            >
                <div
                    ref={row}
                    className={cn('flex w-max gap-1.5 p-px', contentClassName)}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
