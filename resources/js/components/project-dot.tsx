export function ProjectDot({ color }: { color: string }) {
    return (
        <span
            aria-hidden="true"
            className="inline-block size-3 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
        />
    );
}
