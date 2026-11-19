import { Separator } from '@heroui/react';

export function OrSeparator({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-3 text-xs text-muted">
            <Separator className="flex-1" />
            {label}
            <Separator className="flex-1" />
        </div>
    );
}
