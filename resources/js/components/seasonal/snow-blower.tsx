import { Button } from '@heroui/react';
import type { Ref } from 'react';
import { useTranslation } from '@/lib/i18n';
import { SNOW_BLOWER } from '@/lib/snow/geometry';

/**
 * The snowblower parked next to the shovel. The machine itself is a 3D model drawn with the snow
 * (`@/lib/snow`); this is the button over it, which the snow scene's loop moves along while it is driven.
 */
export function SnowBlower({
    isDriving,
    onChange,
    buttonRef,
}: {
    isDriving: boolean;
    onChange: (isDriving: boolean) => void;
    buttonRef: Ref<HTMLButtonElement>;
}) {
    const { t } = useTranslation();
    const label = isDriving
        ? t('Park the snowblower')
        : t('Drive the snowblower with the arrow keys');

    return (
        <Button
            ref={buttonRef}
            variant="ghost"
            aria-label={label}
            aria-pressed={isDriving}
            onPress={() => onChange(!isDriving)}
            className="fixed bottom-0 z-40 h-auto min-w-0 rounded-md bg-transparent p-0 hover:bg-transparent"
            style={{
                // The parked spot; while driving, the loop sets `left` instead.
                right: SNOW_BLOWER.parkedRight,
                width: SNOW_BLOWER.width,
                height: SNOW_BLOWER.height,
            }}
            data-test="snow-blower"
        />
    );
}
