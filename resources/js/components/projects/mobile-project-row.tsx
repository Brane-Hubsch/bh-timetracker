import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { EstimateProgress } from '@/components/estimate-progress';
import { ProjectDot } from '@/components/project-dot';
import { show } from '@/routes/projects';

type Props = {
    project: {
        slug: string;
        name: string;
        color: string;
        consumedSeconds: number;
        estimateSeconds: number | null;
    };
    subtitle?: string | null;
    nameAccessory?: ReactNode;
    trailing: ReactNode;
    noEstimate?: ReactNode;
    testId?: string;
};

export function MobileProjectRow({
    project,
    subtitle,
    nameAccessory,
    trailing,
    noEstimate,
    testId,
}: Props) {
    return (
        <li
            className="relative not-last:after:pointer-events-none not-last:after:absolute not-last:after:right-0 not-last:after:bottom-0 not-last:after:left-9 not-last:after:border-b not-last:after:border-separator not-last:after:content-['']"
            data-test={testId}
        >
            <Link
                href={show({ project: project.slug })}
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 px-4 py-3 transition-colors active:bg-default"
            >
                <span className="flex h-5 items-center">
                    <ProjectDot color={project.color} size="compact" />
                </span>
                <div className="min-w-0">
                    <div className="flex justify-between gap-3 text-[15px]/5 font-medium">
                        <p className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate">{project.name}</span>
                            {nameAccessory}
                        </p>
                        {trailing}
                    </div>
                    {subtitle && (
                        <p className="mt-0.5 truncate text-[13px]/[18px] text-muted">
                            {subtitle}
                        </p>
                    )}
                    {project.estimateSeconds ? (
                        <div className="mt-1">
                            <EstimateProgress
                                consumedSeconds={project.consumedSeconds}
                                estimateSeconds={project.estimateSeconds}
                                display="inline-budget"
                            />
                        </div>
                    ) : (
                        noEstimate
                    )}
                </div>
            </Link>
        </li>
    );
}
