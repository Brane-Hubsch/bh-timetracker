import { ProjectDot } from '@/components/project-dot';
import { formatDecimalHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { ProjectShare } from '@/types';

type Props = {
    projects: ProjectShare[];
    totalSeconds: number;
};

/**
 * Share of time per project as labelled horizontal bars (largest first). Each bar is the project's
 * share of the total, in the project colour; identity comes from the name and dot, never from
 * colour alone.
 */
export function ProjectDistribution({ projects, totalSeconds }: Props) {
    const { t, intlLocale } = useTranslation();
    const share = (seconds: number) =>
        totalSeconds > 0 ? seconds / totalSeconds : 0;
    const percent = new Intl.NumberFormat(intlLocale, {
        style: 'percent',
        maximumFractionDigits: 0,
    });

    return (
        <section
            className="grid h-full grid-cols-1 content-start gap-4 rounded-2xl bg-surface p-4 shadow-surface"
            data-test="project-distribution"
        >
            <h2 className="text-sm font-semibold">{t('Time per project')}</h2>

            {projects.length === 0 ? (
                <p className="text-sm text-muted">
                    {t('No time in this period.')}
                </p>
            ) : (
                <ul className="grid grid-cols-1 gap-3.5">
                    {projects.map((project) => (
                        <li
                            key={project.id ?? 'other'}
                            className="grid grid-cols-1 gap-1"
                        >
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                                <span className="flex min-w-0 items-center gap-2">
                                    {project.color && (
                                        <ProjectDot color={project.color} />
                                    )}
                                    <span className="truncate">
                                        {project.name}
                                        {project.clientName && (
                                            <span className="text-muted">
                                                {' · '}
                                                {project.clientName}
                                            </span>
                                        )}
                                    </span>
                                </span>
                                <span className="shrink-0 tabular-nums">
                                    {formatDecimalHours(
                                        project.seconds,
                                        intlLocale,
                                    )}
                                    <span className="ml-2 text-muted">
                                        {percent.format(share(project.seconds))}
                                    </span>
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-default">
                                <div
                                    className="h-2 origin-left animate-grow-x rounded-full bg-muted transition-[width] duration-300"
                                    style={{
                                        width: `${share(project.seconds) * 100}%`,
                                        backgroundColor:
                                            project.color ?? undefined,
                                    }}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
