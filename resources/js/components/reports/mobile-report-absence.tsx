import { MemberAvatar } from '@/components/reports/report-filter-options';
import { formatDays } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { ReportAbsence } from '@/types';

export function MobileReportAbsence({
    absence,
    avatars,
}: {
    absence: ReportAbsence;
    avatars: ReadonlyMap<string, string | null>;
}) {
    const { t, intlLocale } = useTranslation();
    const days = (seconds: number) =>
        formatDays(seconds / absence.workdaySeconds, intlLocale);

    return (
        <section className="pt-6 md:hidden">
            <h2 className="px-4 text-[15px]/5 font-semibold">{t('Absence')}</h2>
            <ul className="mt-2">
                {absence.members.map((member) => (
                    <li
                        key={member.id}
                        className="group flex items-start gap-3 ps-4"
                    >
                        <div className="mt-3">
                            <MemberAvatar
                                name={member.name}
                                src={avatars.get(String(member.id)) ?? null}
                                size="md"
                            />
                        </div>
                        <div className="min-w-0 flex-1 border-b border-separator py-2.5 pe-4 group-last:border-b-0">
                            <div className="flex justify-between gap-2 text-[15px]/5 font-medium">
                                <span className="truncate">{member.name}</span>
                                <span className="shrink-0 tabular-nums">
                                    {days(member.seconds)}
                                </span>
                            </div>
                            <p className="mt-1 text-[13px]/[18px] text-muted">
                                {absence.types
                                    .flatMap(({ value, label }) => {
                                        const seconds =
                                            member.types[value] ?? 0;
                                        return seconds > 0
                                            ? [`${label} ${days(seconds)}`]
                                            : [];
                                    })
                                    .join(' · ')}
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
            <p className="mt-2 px-4 text-xs text-muted">
                {t(
                    'Days are absence hours divided by the working day; weekends and holidays don’t count.',
                )}
            </p>
        </section>
    );
}
