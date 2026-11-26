import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function MobilePageHeader({
    className,
    ...props
}: ComponentProps<'div'>) {
    return (
        <div
            {...props}
            className={cn(
                'mobile-page-header max-md:sticky max-md:top-0 max-md:z-20 max-md:min-h-[calc(3.125rem+env(safe-area-inset-top))] max-md:flex-nowrap max-md:gap-2 max-md:border-b max-md:border-separator max-md:bg-surface/95 max-md:px-4 max-md:pt-[calc(0.25rem+env(safe-area-inset-top))] max-md:pb-2 max-md:shadow-sm max-md:backdrop-blur',
                className,
            )}
        />
    );
}
