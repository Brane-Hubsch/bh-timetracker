import { cn } from '@/lib/utils';

type Props = {
    /** Logo URL, or null to show the name's initial. */
    src: string | null | undefined;
    name: string;
    /** Edge length in pixels. */
    size?: number;
    className?: string;
};

/**
 * An organization or client logo: square with rounded corners so logos are never cropped (unlike
 * round avatars), on a bordered surface; the first letter of the name when there is no logo.
 */
export function LogoImage({ src, name, size = 32, className }: Props) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg',
                src
                    ? 'border border-separator bg-surface'
                    : 'bg-default text-muted',
                className,
            )}
            // Padding in pixels: a percentage would follow the parent's width, not the logo's.
            style={{
                width: size,
                height: size,
                padding: src ? Math.round(size * 0.12) : undefined,
            }}
            aria-hidden="true"
        >
            {src ? (
                <img
                    src={src}
                    alt=""
                    className="size-full object-contain"
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
