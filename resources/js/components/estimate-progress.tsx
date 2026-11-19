import { ProgressBar } from '@heroui/react';
import { formatHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';

type Props = {
    consumedSeconds: number;
    estimateSeconds: number;
};

/**
 * Consumed vs estimate, warning at 80 % and danger at 100 %.
 */
export function EstimateProgress({ consumedSeconds, estimateSeconds }: Props) {
    const { t, intlLocale } = useTranslation();
    const ratio = estimateSeconds > 0 ? consumedSeconds / estimateSeconds : 0;
    const color = ratio >= 1 ? 'danger' : ratio >= 0.8 ? 'warning' : 'accent';

    return (
        <ProgressBar
            aria-label={t('Estimate')}
            value={Math.min(ratio * 100, 100)}
            color={color}
            className="w-full"
        >
            <div className="flex justify-between text-xs">
                <span>
                    {t(':consumed of :estimate', {
                        consumed: formatHours(consumedSeconds, intlLocale),
                        estimate: formatHours(estimateSeconds, intlLocale),
                    })}
                </span>
                <span
                    className={
                        ratio >= 0.8 ? 'font-medium text-warning' : 'text-muted'
                    }
                >
                    {Math.round(ratio * 100)} %
                </span>
            </div>
            <ProgressBar.Track>
                <ProgressBar.Fill />
            </ProgressBar.Track>
        </ProgressBar>
    );
}
