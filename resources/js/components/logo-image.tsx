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
    const inset = src && fit === 'contain';

    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg',
                src ? 'bg-surface' : 'bg-default text-muted',
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
                    src={src}
                    alt=""
                    className={cn(
                        'size-full',
                        fit === 'cover' ? 'object-cover' : 'object-contain',
                    )}
                    loading="lazy"
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
