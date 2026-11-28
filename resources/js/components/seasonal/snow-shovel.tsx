import { Button } from '@heroui/react';
import { useTranslation } from '@/lib/i18n';
import { SNOW_SHOVEL } from '@/lib/snow/geometry';

/**
 * The shovel stuck in the snow in the bottom right corner. The shovel itself is a 3D model drawn with
 * the snow (`@/lib/snow`); this is the button over it. Pick it up to shovel the drift with the mouse;
 * click the spot again (or press Escape) to put it back.
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
    const { right, above } = SNOW_SHOVEL.parked;

    return (
        <Button
            variant="ghost"
            aria-label={label}
            aria-pressed={isShovelling}
            onPress={() => onChange(!isShovelling)}
            className="fixed bottom-0 z-40 h-auto min-w-0 rounded-md bg-transparent p-0 hover:bg-transparent"
            // Tall enough to cover it however deep the snow is.
            style={{ right: right - 26, width: 52, height: above + 50 }}
            data-test="snow-shovel"
        />
    );
}
