import {
    createContext,
    use,
    useLayoutEffect,
    useRef,
    type ComponentProps,
} from 'react';
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
    const spacerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const spacer = spacerRef.current;
        const header = target?.firstElementChild ?? spacer?.nextElementSibling;
        if (isDesktop || !spacer || !header) {
            return;
        }

        const rootStyle = document.documentElement.style;
        const measure = () => {
            const height = `${header.getBoundingClientRect().height}px`;
            spacer.style.blockSize = height;
            rootStyle.setProperty(
                '--mobile-page-header-visible-height',
                height,
            );
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(header, { box: 'border-box' });

        return () => {
            observer.disconnect();
            rootStyle.removeProperty('--mobile-page-header-visible-height');
        };
    }, [isDesktop, target]);

    const header = (
        <div
            {...props}
            className={cn(
                'mobile-page-header max-md:min-h-(--mobile-page-header-height) max-md:flex-nowrap max-md:gap-2 max-md:border-b max-md:border-separator max-md:bg-surface max-md:px-4 max-md:pt-[calc(0.3125rem+env(safe-area-inset-top))] max-md:pb-[9px] max-md:shadow-[0_1px_4px_#0000000a]',
                !target &&
                    'max-md:fixed max-md:inset-x-0 max-md:top-0 max-md:z-20',
                className,
            )}
        />
    );

    return (
        <>
            <div
                ref={spacerRef}
                aria-hidden="true"
                className="mobile-page-header-spacer hidden min-h-(--mobile-page-header-height) shrink-0 max-md:block"
            />
            {target ? createPortal(header, target) : header}
        </>
    );
}
