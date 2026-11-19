import { Button, Checkbox } from '@heroui/react';
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { ProjectDot } from '@/components/project-dot';
import { ResponsiveDialog } from '@/components/responsive-dialog';
import { useTranslation } from '@/lib/i18n';
import { formatDate, formatDuration, timeOf } from '@/lib/time';
import { copy } from '@/routes/time';
import type { TimeEntry } from '@/types';

type Props = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    /** Loaded on demand (Inertia optional prop). */
    entries: TimeEntry[] | undefined;
};

/**
 * "Copy previous week" as a draft: the user picks which entries to copy to this week.
 */
export function CopyWeekDialog({ isOpen, onOpenChange, entries }: Props) {
    const { t, intlLocale } = useTranslation();
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (isOpen && entries === undefined) {
            router.reload({ only: ['previousWeek'] });
        }
    }, [isOpen, entries]);

    useEffect(() => {
        setSelected(new Set((entries ?? []).map((entry) => entry.id)));
    }, [entries]);

    const toggle = (id: number) =>
        setSelected((current) => {
            const next = new Set(current);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });

    const submit = () =>
        router.post(
            copy.url(),
            { entry_ids: [...selected] },
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: () => onOpenChange(false),
            },
        );

    return (
        <ResponsiveDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title={t('Copy previous week')}
            footer={
                <>
                    <Button slot="close" variant="tertiary">
                        {t('Cancel')}
                    </Button>
                    <Button
                        onPress={submit}
                        isDisabled={selected.size === 0}
                        isPending={processing}
                        data-test="copy-week-confirm"
                    >
                        {t('Copy :count entries', { count: selected.size })}
                    </Button>
                </>
            }
        >
            {entries === undefined ? (
                <p className="text-sm text-muted">{t('Loading…')}</p>
            ) : entries.length === 0 ? (
                <p className="text-sm text-muted">
                    {t('No time was reported last week.')}
                </p>
            ) : (
                <div className="grid gap-1">
                    <p className="mb-2 text-sm text-muted">
                        {t(
                            'The selected entries are added to this week, seven days later.',
                        )}
                    </p>
                    {entries.map((entry) => (
                        <Checkbox
                            key={entry.id}
                            isSelected={selected.has(entry.id)}
                            onChange={() => toggle(entry.id)}
                            className="rounded-xl p-2 transition-colors hover:bg-surface-secondary"
                        >
                            <Checkbox.Content>
                                <Checkbox.Control>
                                    <Checkbox.Indicator />
                                </Checkbox.Control>
                                <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                                    <ProjectDot color={entry.project.color} />
                                    <span className="w-20 shrink-0 text-muted first-letter:uppercase">
                                        {formatDate(entry.date, intlLocale, {
                                            weekday: 'short',
                                        })}{' '}
                                        {timeOf(entry.start)}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">
                                        {entry.project.name}
                                        {entry.description && (
                                            <span className="text-muted">
                                                {' '}
                                                · {entry.description}
                                            </span>
                                        )}
                                    </span>
                                    <span className="tabular-nums">
                                        {formatDuration(entry.durationSeconds)}
                                    </span>
                                </span>
                            </Checkbox.Content>
                        </Checkbox>
                    ))}
                </div>
            )}
        </ResponsiveDialog>
    );
}
