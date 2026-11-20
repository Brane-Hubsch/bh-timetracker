import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export default function Heading({
    title,
    description,
    variant = 'default',
    actions,
    className,
}: {
    title: ReactNode;
    description?: ReactNode;
    variant?: 'default' | 'small';
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <header
            className={cn(
                'flex flex-wrap items-start justify-between gap-4',
                className,
            )}
        >
            <div className="space-y-1">
                {variant === 'small' ? (
                    <h2 className="text-base font-semibold">{title}</h2>
                ) : (
                    <h1 className="text-xl font-semibold tracking-tight">
                        {title}
                    </h1>
                )}
                {description && (
                    <p className="text-sm text-muted">{description}</p>
                )}
            </div>
            {actions}
        </header>
    );
}
