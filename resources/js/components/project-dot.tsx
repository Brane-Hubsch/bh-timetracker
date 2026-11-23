export function ProjectDot({
    color,
    size = 'md',
}: {
    color: string;
    size?: 'sm' | 'md';
}) {
    return (
        <span
            aria-hidden="true"
            className={`inline-block shrink-0 rounded-full ${size === 'sm' ? 'size-2' : 'size-3'}`}
            style={{ backgroundColor: color }}
        />
    );
}
