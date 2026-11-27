import { useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { isAndroidTouch, vibrateLightly } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export function HapticTap<T extends HTMLElement>({
    children,
    className,
    enabled = true,
    round = false,
}: {
    children: (ref: RefObject<T | null>) => ReactNode;
    className?: string;
    enabled?: boolean;
    round?: boolean;
}) {
    const target = useRef<T>(null);

    return (
        <div
            className={cn('relative', className)}
            onClickCapture={({ nativeEvent }) => {
                if (
                    enabled &&
                    nativeEvent instanceof PointerEvent &&
                    isAndroidTouch(nativeEvent.pointerType === 'touch') &&
                    matchMedia('(width < 48rem)').matches
                ) {
                    vibrateLightly();
                }
            }}
        >
            {children(target)}
            {enabled && (
                // Safari plays switch haptics on a real tap. Keep the visible
                // control as the keyboard and screen reader target.
                <input
                    type="checkbox"
                    {...{ switch: '' }}
                    aria-hidden="true"
                    tabIndex={-1}
                    className={cn(
                        'absolute inset-0 hidden size-full appearance-auto opacity-0 max-md:pointer-coarse:supports-[-webkit-touch-callout:none]:block',
                        round && '[clip-path:circle(50%)]',
                    )}
                    onChange={() => {
                        target.current?.focus({ preventScroll: true });
                        target.current?.click();
                    }}
                />
            )}
        </div>
    );
}
