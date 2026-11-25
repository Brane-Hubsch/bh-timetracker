import { Avatar } from '@heroui/react';
import { useInitials } from '@/hooks/use-initials';

export function ReportMemberName({
    name,
    avatar,
    size = 'sm',
}: {
    name: string;
    avatar: string | null | undefined;
    size?: 'sm' | 'md';
}) {
    const getInitials = useInitials();

    return (
        <span className="flex min-w-0 items-center gap-2">
            <Avatar
                size="sm"
                variant="soft"
                color="accent"
                className={`${size === 'sm' ? 'size-6' : 'size-8'} shrink-0 rounded-full`}
                aria-hidden="true"
            >
                {avatar && (
                    <Avatar.Image
                        src={avatar}
                        alt=""
                        className="object-cover"
                    />
                )}
                <Avatar.Fallback
                    className={size === 'sm' ? 'text-[10px]' : undefined}
                >
                    {getInitials(name)}
                </Avatar.Fallback>
            </Avatar>
            <span className="min-w-0 wrap-break-word">{name}</span>
        </span>
    );
}
