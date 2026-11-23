import { Avatar } from '@heroui/react';
import { useInitials } from '@/hooks/use-initials';

export function MemberAvatar({
    name,
    avatar,
    large = false,
}: {
    name: string;
    avatar: string | null;
    large?: boolean;
}) {
    const getInitials = useInitials();

    return (
        <Avatar
            className={`${large ? 'size-14' : 'size-9'} shrink-0 [--avatar-radius:9999px]`}
        >
            {avatar && (
                <Avatar.Image src={avatar} alt="" className="object-cover" />
            )}
            <Avatar.Fallback>{getInitials(name)}</Avatar.Fallback>
        </Avatar>
    );
}
