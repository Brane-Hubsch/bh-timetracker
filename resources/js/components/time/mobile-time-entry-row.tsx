import type { ReactNode } from 'react';
import { ProjectDot } from '@/components/project-dot';
import { TimeEntryTags } from '@/components/time/time-entry-tags';
import { formatDuration, timeOf } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { TimeEntry } from '@/types';

export const mobileTimeEntryDivider =
    'relative not-last:after:pointer-events-none not-last:after:absolute not-last:after:inset-x-0 not-last:after:bottom-0 not-last:after:ms-9 not-last:after:border-b not-last:after:border-separator';

export function MobileTimeEntryRow({
    entry,
    emptyDescription,
    member,
    amount,
    onPress,
}: {
    entry: Pick<
        TimeEntry,
        'project' | 'durationSeconds' | 'description' | 'tags' | 'start' | 'end'
    >;
    emptyDescription?: string;
    member?: { name: string; avatar: ReactNode };
    amount?: ReactNode;
    onPress?: () => void;
}) {
    const Row = onPress ? 'button' : 'div';
    const timeRange = `${timeOf(entry.start)}–${timeOf(entry.end)}`;

    return (
        <Row
            type={onPress ? 'button' : undefined}
            onClick={onPress}
            data-test={onPress ? 'time-entry-row' : undefined}
            className={cn(
                'grid w-full grid-cols-[auto_minmax(0,1fr)] gap-2.5 px-4 py-3 text-left',
                onPress &&
                    'transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-default',
            )}
        >
            <span className="flex h-5 items-center">
                <ProjectDot color={entry.project.color} size="compact" />
            </span>
            <span className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1">
                <span className="flex items-start justify-between gap-2 text-[15px]/5 font-medium">
                    <span className="truncate">{entry.project.name}</span>
                    <span className="shrink-0 tabular-nums">
                        {formatDuration(entry.durationSeconds)}
                    </span>
                </span>
                {(entry.description || emptyDescription) && (
                    <span
                        className={cn(
                            'line-clamp-2 text-sm',
                            !entry.description && 'text-muted',
                        )}
                    >
                        {entry.description || emptyDescription}
                    </span>
                )}
                <TimeEntryTags tags={entry.tags} mobile />
                <span className="flex items-center justify-between gap-2 text-[13px]/[18px] text-muted">
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        {member?.avatar}
                        <span className="truncate">
                            {[member?.name, timeRange, entry.project.clientName]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                    </span>
                    {amount && (
                        <span className="shrink-0 tabular-nums">{amount}</span>
                    )}
                </span>
            </span>
        </Row>
    );
}
