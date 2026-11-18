import type { ReactNode } from 'react';

export default function Heading({
    title,
    description,
    variant = 'default',
    actions,
}: {
    title: ReactNode;
    description?: ReactNode;
    variant?: 'default' | 'small';
    actions?: ReactNode;
}) {
    return (
        <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
                <h2
                    className={
                        variant === 'small'
                            ? 'text-base font-semibold'
                            : 'text-xl font-semibold tracking-tight'
                    }
                >
                    {title}
                </h2>
                {description && (
                    <p className="text-sm text-muted">{description}</p>
                )}
            </div>
            {actions}
        </header>
    );
}
