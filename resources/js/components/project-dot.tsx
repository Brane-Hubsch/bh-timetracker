import { cn } from '@/lib/utils';

const sizes = { sm: 'size-2', compact: 'size-2.5', md: 'size-3' };

export function ProjectDot({
    color,
    size = 'md',
    className,
}: {
    color: string;
    size?: keyof typeof sizes;
    className?: string;
}) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                'inline-block shrink-0 rounded-full',
                sizes[size],
                className,
            )}
            style={{ backgroundColor: color }}
        />
    );
}
