import { Button } from '@heroui/react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** The shovel drawing; also used as the cursor while shovelling (see .is-shovelling in app.css). */
function ShovelDrawing() {
    return (
        <svg
            width="40"
            height="100"
            viewBox="0 0 40 100"
            fill="none"
            aria-hidden="true"
            // Inline, because the button styles shrink icons to 16 px.
            style={{ width: 24, height: 60 }}
        >
            <path
                fillRule="evenodd"
                d="M14 4h12a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4h-3v46h-6V17h-3a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Zm1 4v5h10V8H15Z"
                fill="#374151"
            />
            <rect x="17.5" y="16" width="5" height="48" rx="1" fill="#B45309" />
            <rect x="15" y="60" width="10" height="7" rx="1.5" fill="#64748B" />
            <path
                d="M8 65h24l2 29a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4l2-29Z"
                fill="#CBD5E1"
                stroke="#475569"
                strokeWidth="1.5"
            />
        </svg>
    );
}

/**
 * A shovel leaning in the bottom right corner. Pick it up to shovel the snow drift with the mouse; click
 * it again (or press Escape) to put it back.
 */
export function SnowShovel({
    isShovelling,
    onChange,
}: {
    isShovelling: boolean;
    onChange: (isShovelling: boolean) => void;
}) {
    const { t } = useTranslation();
    const label = isShovelling
        ? t('Put the shovel back')
        : t('Pick up the shovel');

    return (
        <Button
            variant="ghost"
            aria-label={label}
            aria-pressed={isShovelling}
            onPress={() => onChange(!isShovelling)}
            className={cn(
                'fixed right-4 bottom-0 z-40 h-auto w-auto min-w-0 origin-bottom rotate-12 rounded-md bg-transparent p-0 transition-[opacity,transform] duration-200 hover:-translate-y-1 hover:rotate-6 hover:bg-transparent',
                isShovelling && 'opacity-40',
            )}
            data-test="snow-shovel"
        >
            <ShovelDrawing />
        </Button>
    );
}
