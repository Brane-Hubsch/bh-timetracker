import { formatDecimalHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { formatDate, formatDateRange } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { EstimatePace } from '@/types';

function Stat({
    label,
    value,
    hint,
    isWarning = false,
}: {
    label: string;
    value: string;
    hint?: string;
    isWarning?: boolean;
}) {
    return (
        <div className="grid content-start gap-0.5 rounded-xl bg-surface-secondary px-4 py-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd
                className={cn(
                    'text-lg font-semibold tabular-nums',
                    isWarning && 'text-warning',
                )}
            >
                {value}
            </dd>
            {hint && <dd className="text-xs text-muted">{hint}</dd>}
        </div>
    );
}

/**
 * The hours left to a project's estimate, the working days left in its period and the hours needed
 * per working day to reach 100 %.
 */
export function EstimatePaceStats({ pace }: { pace: EstimatePace }) {
    const { t, intlLocale } = useTranslation();
    const hours = (seconds: number) => formatDecimalHours(seconds, intlLocale);
    const isOver = pace.remainingSeconds < 0;
    const isReached = pace.remainingSeconds <= 0;
    const hasEnded =
        pace.from !== null && pace.to !== null && pace.from > pace.to;
    const shortDate = { day: 'numeric', month: 'short' } as const;

    const periodHint =
        pace.to === null
            ? t('No end date')
            : hasEnded
              ? t('The period ended :date', {
                    date: formatDate(pace.to, intlLocale, shortDate),
                })
              : formatDateRange(pace.from ?? pace.to, pace.to, intlLocale);

    const paceHint = isReached
        ? t('The estimate is reached')
        : pace.workdaysLeft === null
          ? t('Set an end date')
          : pace.workdaysLeft === 0
            ? t('No working days left')
            : t('to reach 100 %');

    return (
        <div className="grid gap-2" data-test="estimate-pace">
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Stat
                    label={
                        isOver
                            ? t('Over the estimate')
                            : t('Left to the estimate')
                    }
                    value={hours(Math.abs(pace.remainingSeconds))}
                    isWarning={isOver}
                />
                <Stat
                    label={t('Working days left')}
                    value={
                        pace.workdaysLeft === null
                            ? '–'
                            : String(pace.workdaysLeft)
                    }
                    hint={periodHint}
                />
                <Stat
                    label={t('Needed per working day')}
                    value={
                        pace.secondsPerWorkday === null
                            ? '–'
                            : hours(pace.secondsPerWorkday)
                    }
                    hint={paceHint}
                />
            </dl>
            {pace.workdaysLeft !== null && (
                <p className="text-xs text-muted">
                    {t(
                        "Working days are Monday to Friday, without public holidays and midsummer, Christmas and New Year's Eve.",
                    )}
                </p>
            )}
        </div>
    );
}
