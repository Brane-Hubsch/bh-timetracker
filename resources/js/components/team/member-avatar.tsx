import { Avatar } from '@heroui/react';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';

export function MemberAvatar({
    name,
    avatar,
    large = false,
    className,
}: {
    name: string;
    avatar: string | null;
    large?: boolean;
    className?: string;
}) {
    const getInitials = useInitials();

    return (
        <Avatar
            className={cn(
                large ? 'size-14' : 'size-9',
                'shrink-0 [--avatar-radius:9999px]',
                className,
            )}
        >
            {avatar && (
                <Avatar.Image src={avatar} alt="" className="object-cover" />
            )}
            <Avatar.Fallback className="max-md:bg-accent-soft max-md:text-accent-soft-foreground">
                {getInitials(name)}
            </Avatar.Fallback>
        </Avatar>
    );
}
