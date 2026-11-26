const sizes = { sm: 'size-2', compact: 'size-2.5', md: 'size-3' };

export function ProjectDot({
    color,
    size = 'md',
}: {
    color: string;
    size?: keyof typeof sizes;
}) {
    return (
        <span
            aria-hidden="true"
            className={`inline-block shrink-0 rounded-full ${sizes[size]}`}
            style={{ backgroundColor: color }}
        />
    );
}
