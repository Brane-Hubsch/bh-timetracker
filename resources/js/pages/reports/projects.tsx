import { Link } from '@inertiajs/react';
import { EstimateProgress } from '@/components/estimate-progress';
import { ProjectDot } from '@/components/project-dot';
import { ReportLayout } from '@/components/reports/report-layout';
import { formatDecimalHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { show as showProject } from '@/routes/projects';
import type { FollowUpProject } from '@/types';

type Props = {
    projects: FollowUpProject[];
};

/**
 * Every active project with its estimate, time used, time left and progress. Projects over their
 * estimate come first.
 */
export default function ReportsProjects({ projects }: Props) {
    const { t, intlLocale } = useTranslation();

    const sorted = [...projects].sort(
        (a, b) => (b.percent ?? -1) - (a.percent ?? -1),
    );

    return (
        <ReportLayout current="projects">
            {sorted.length === 0 ? (
                <p className="rounded-2xl bg-surface p-6 text-center text-sm text-muted shadow-surface">
                    {t('No active projects.')}
                </p>
            ) : (
                <ul
                    className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3"
                    data-test="follow-up"
                >
                    {sorted.map((project) => (
                        <li
                            key={project.id}
                            className="grid grid-cols-1 gap-3 rounded-2xl bg-surface p-4 shadow-surface"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <Link
                                    href={showProject({
                                        project: project.slug,
                                    })}
                                    className="min-w-0 flex-1"
                                >
                                    <span className="flex items-center gap-2 font-medium">
                                        <ProjectDot color={project.color} />
                                        <span className="truncate">
                                            {project.name}
                                        </span>
                                    </span>
                                    {project.clientName && (
                                        <span className="block truncate pl-5 text-sm text-muted">
                                            {project.clientName}
                                        </span>
                                    )}
                                </Link>
                                {project.remainingSeconds !== null && (
                                    <span
                                        className={`shrink-0 text-sm tabular-nums ${project.remainingSeconds < 0 ? 'font-medium text-danger' : 'text-muted'}`}
                                    >
                                        {project.remainingSeconds < 0
                                            ? t(':hours over', {
                                                  hours: formatDecimalHours(
                                                      -project.remainingSeconds,
                                                      intlLocale,
                                                  ),
                                              })
                                            : t(':hours left', {
                                                  hours: formatDecimalHours(
                                                      project.remainingSeconds,
                                                      intlLocale,
                                                  ),
                                              })}
                                    </span>
                                )}
                            </div>

                            {project.estimateSeconds ? (
                                <EstimateProgress
                                    consumedSeconds={project.consumedSeconds}
                                    estimateSeconds={project.estimateSeconds}
                                />
                            ) : (
                                <p className="text-sm text-muted">
                                    {t(':hours reported, no estimate', {
                                        hours: formatDecimalHours(
                                            project.consumedSeconds,
                                            intlLocale,
                                        ),
                                    })}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </ReportLayout>
    );
}

ReportsProjects.layout = { width: 'wide' };
