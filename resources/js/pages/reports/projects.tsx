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

    const remaining = (project: FollowUpProject) => {
        const seconds = project.remainingSeconds;
        if (seconds === null) return null;

        return (
            <span
                className={`shrink-0 text-sm tabular-nums ${seconds < 0 ? 'font-medium text-danger' : 'font-normal text-muted'}`}
            >
                {t(seconds < 0 ? ':hours over' : ':hours left', {
                    hours: formatDecimalHours(Math.abs(seconds), intlLocale),
                })}
            </span>
        );
    };
    const noEstimate = (project: FollowUpProject) =>
        t(':hours reported, no estimate', {
            hours: formatDecimalHours(project.consumedSeconds, intlLocale),
        });

    return (
        <ReportLayout current="projects">
            {sorted.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted max-md:grid max-md:min-h-[60svh] max-md:place-content-center md:rounded-2xl md:bg-surface md:shadow-surface">
                    {t('No active projects.')}
                </p>
            ) : (
                <>
                    <ul className="md:hidden" data-test="mobile-follow-up">
                        {sorted.map((project) => (
                            <li
                                key={project.id}
                                className="relative not-last:after:pointer-events-none not-last:after:absolute not-last:after:inset-x-0 not-last:after:bottom-0 not-last:after:ms-9 not-last:after:border-b not-last:after:border-separator"
                            >
                                <Link
                                    href={showProject({
                                        project: project.slug,
                                    })}
                                    className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 px-4 py-3 transition-colors active:bg-default"
                                >
                                    <span className="flex h-5 items-center">
                                        <ProjectDot
                                            color={project.color}
                                            size="compact"
                                        />
                                    </span>
                                    <div className="min-w-0">
                                        <div className="flex justify-between gap-2 text-[15px]/5 font-medium">
                                            <span className="truncate">
                                                {project.name}
                                            </span>
                                            {remaining(project)}
                                        </div>
                                        {project.clientName && (
                                            <p className="truncate text-[13px]/5 text-muted">
                                                {project.clientName}
                                            </p>
                                        )}
                                        {project.estimateSeconds ? (
                                            <div className="mt-1">
                                                <EstimateProgress
                                                    consumedSeconds={
                                                        project.consumedSeconds
                                                    }
                                                    estimateSeconds={
                                                        project.estimateSeconds
                                                    }
                                                    display="inline-budget"
                                                />
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted">
                                                {noEstimate(project)}
                                            </p>
                                        )}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                    <ul
                        className="hidden grid-cols-2 gap-3 md:grid 2xl:grid-cols-3"
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
                                    {remaining(project)}
                                </div>

                                {project.estimateSeconds ? (
                                    <EstimateProgress
                                        consumedSeconds={
                                            project.consumedSeconds
                                        }
                                        estimateSeconds={
                                            project.estimateSeconds
                                        }
                                    />
                                ) : (
                                    <p className="text-sm text-muted">
                                        {noEstimate(project)}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </ReportLayout>
    );
}

ReportsProjects.layout = { width: 'wide' };
