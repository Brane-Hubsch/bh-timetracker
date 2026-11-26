import { ProgressBar } from '@heroui/react';
import { formatHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';

type Props = {
    consumedSeconds: number;
    estimateSeconds: number;
    display?: 'comparison' | 'budget' | 'inline-budget';
};

/**
 * Consumed vs estimate, warning at 80 % and danger at 100 %.
 */
export function EstimateProgress({
    consumedSeconds,
    estimateSeconds,
    display = 'comparison',
}: Props) {
    const { t, intlLocale } = useTranslation();
    const ratio = estimateSeconds > 0 ? consumedSeconds / estimateSeconds : 0;
    const color = ratio >= 1 ? 'danger' : ratio >= 0.8 ? 'warning' : 'accent';
    const estimate = formatHours(estimateSeconds, intlLocale);
    const percent = `${Math.round(ratio * 100)} %`;
    const isBudget = display === 'budget';
    const isInlineBudget = display === 'inline-budget';
    const inlineLabel = t(':consumed of :estimate', {
        consumed: percent,
        estimate,
    });
    const labelColor =
        isInlineBudget && color === 'danger'
            ? 'font-medium text-danger'
            : ratio >= 0.8
              ? 'font-medium text-warning'
              : 'text-muted';

    return (
        <ProgressBar
            aria-label={t(isBudget || isInlineBudget ? 'Budget' : 'Estimate')}
            value={Math.min(ratio * 100, 100)}
            valueLabel={
                isInlineBudget
                    ? inlineLabel
                    : isBudget
                      ? `${estimate}, ${percent}`
                      : undefined
            }
            color={color}
            className={
                isInlineBudget
                    ? 'flex w-full flex-row items-center gap-2.5'
                    : 'w-full'
            }
        >
            {!isInlineBudget && (
                <div
                    className={`flex justify-between text-xs ${isBudget ? 'gap-1 tabular-nums' : ''}`}
                >
                    <span>
                        {isBudget
                            ? estimate
                            : t(':consumed of :estimate', {
                                  consumed: formatHours(
                                      consumedSeconds,
                                      intlLocale,
                                  ),
                                  estimate,
                              })}
                    </span>
                    <span className={labelColor}>{percent}</span>
                </div>
            )}
            <ProgressBar.Track
                className={
                    isInlineBudget
                        ? 'h-1 min-w-0 flex-1'
                        : isBudget
                          ? 'h-1.5'
                          : undefined
                }
            >
                <ProgressBar.Fill />
            </ProgressBar.Track>
            {isInlineBudget && (
                <span className={`shrink-0 text-xs tabular-nums ${labelColor}`}>
                    {inlineLabel}
                </span>
            )}
        </ProgressBar>
    );
}
