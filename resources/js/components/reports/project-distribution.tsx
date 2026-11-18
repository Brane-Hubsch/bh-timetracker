import { ProjectDot } from '@/components/project-dot';
import { formatDecimalHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { ProjectShare } from '@/types';

type Props = {
    projects: ProjectShare[];
    totalSeconds: number;
};

/**
 * Share of time per project as labelled horizontal bars (largest first). Identity comes from the
 * project name and dot, never from colour alone.
 */
export function ProjectDistribution({ projects, totalSeconds }: Props) {
    const { t, intlLocale } = useTranslation();
    const largest = Math.max(1, ...projects.map((project) => project.seconds));
    const percent = new Intl.NumberFormat(intlLocale, {
        style: 'percent',
        maximumFractionDigits: 0,
    });

    return (
        <section
            className="grid gap-3 rounded-2xl bg-surface p-4 shadow-surface"
            data-test="project-distribution"
        >
            <h2 className="text-sm font-semibold">{t('Time per project')}</h2>

            {projects.length === 0 ? (
                <p className="text-sm text-muted">
                    {t('No time in this period.')}
                </p>
            ) : (
                <ul className="grid gap-3">
                    {projects.map((project) => (
                        <li key={project.id ?? 'other'} className="grid gap-1">
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
                                        {percent.format(
                                            totalSeconds > 0
                                                ? project.seconds / totalSeconds
                                                : 0,
                                        )}
                                    </span>
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-default">
                                <div
                                    className="h-2 rounded-full bg-accent"
                                    style={{
                                        width: `${(project.seconds / largest) * 100}%`,
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
