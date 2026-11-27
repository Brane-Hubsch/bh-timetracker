import { createContext, use, type ComponentProps } from 'react';
import { createPortal } from 'react-dom';
import { useIsDesktop } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

export const MobilePageHeaderHost = createContext<HTMLDivElement | null>(null);

export function MobilePageHeader({
    className,
    ...props
}: ComponentProps<'div'>) {
    const host = use(MobilePageHeaderHost);
    const isDesktop = useIsDesktop();
    const target = isDesktop ? null : host;

    const header = (
        <div
            {...props}
            className={cn(
                'mobile-page-header max-md:min-h-(--mobile-page-header-height) max-md:flex-nowrap max-md:gap-2 max-md:border-b max-md:border-separator max-md:bg-surface max-md:px-4 max-md:pt-[calc(0.3125rem+env(safe-area-inset-top))] max-md:pb-[9px] max-md:shadow-[0_1px_4px_#0000000a]',
                className,
            )}
        />
    );

    return target ? createPortal(header, target) : header;
}
