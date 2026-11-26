export function TimeEntryTags({
    tags,
    mobile = false,
}: {
    tags: string[];
    mobile?: boolean;
}) {
    return (
        tags.length > 0 && (
            <span className={`flex flex-wrap gap-1 ${mobile ? '' : 'mt-1'}`}>
                {tags.map((tag) => (
                    <span
                        key={tag}
                        className="max-w-full truncate rounded-full bg-default px-2 py-0.5 text-xs text-default-foreground"
                    >
                        {tag}
                    </span>
                ))}
            </span>
        )
    );
}
