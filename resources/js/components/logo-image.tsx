import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    /** Logo URL, or null to show the name's initial. */
    src: string | null | undefined;
    name: string;
    /** Edge length in pixels. */
    size?: number;
    fit?: 'contain' | 'cover';
    className?: string;
};

/** A square logo with rounded corners and an initial as fallback. */
export function LogoImage({
    src,
    name,
    size = 32,
    fit = 'contain',
    className,
}: Props) {
    const [insetSource, setInsetSource] = useState<string | null>(null);
    const inset = src && fit === 'contain' && insetSource === src;
    const updateInset = useCallback(
        (image: HTMLImageElement | null) => {
            if (image?.naturalWidth) {
                // Website logos are already composed on a square canvas.
                setInsetSource(
                    image.naturalWidth !== image.naturalHeight
                        ? (src ?? null)
                        : null,
                );
            }
        },
        [src],
    );

    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg',
                src && (inset || fit === 'cover') ? 'bg-surface' : 'bg-default',
                !src && 'text-muted',
                inset && 'border border-separator',
                className,
            )}
            // Padding in pixels: a percentage would follow the parent's width, not the logo's.
            style={{
                width: size,
                height: size,
                padding: inset ? Math.round(size * 0.12) : undefined,
            }}
            aria-hidden="true"
        >
            {src ? (
                <img
                    key={src}
                    ref={fit === 'contain' ? updateInset : undefined}
                    src={src}
                    alt=""
                    className={cn(
                        'size-full',
                        fit === 'cover' ? 'object-cover' : 'object-contain',
                    )}
                    loading="lazy"
                    onLoad={
                        fit === 'contain'
                            ? (event) => updateInset(event.currentTarget)
                            : undefined
                    }
                />
            ) : (
                <span
                    className="font-semibold"
                    style={{ fontSize: Math.round(size * 0.42) }}
                >
                    {name.trim().charAt(0).toUpperCase()}
                </span>
            )}
        </span>
    );
}
