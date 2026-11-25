import { toast } from '@heroui/react';
import { usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import type { AbsenceOptions } from '@/components/time/absence-dialog';
import {
    newDraft,
    newPlusDraft,
    plusDurationStorageKey,
    savePlusDurationMinutes,
} from '@/components/time/drafts';
import { startTimer } from '@/components/time/running-timer';
import { TimeActionsMenu } from '@/components/time/time-actions-menu';
import { TimeEntryForm } from '@/components/time/time-entry-form';
import { useTranslation } from '@/lib/i18n';
import { reportOptions } from '@/routes/time';
import type {
    Organization,
    ProjectOption,
    TimeEntryDraft,
    TimeEntryMemberOption,
    TimeReportMode,
} from '@/types';

type ReportOptions = {
    today: string;
    projects: ProjectOption[];
    tags: string[];
    recentTags: string[];
    members: TimeEntryMemberOption[];
    recentProjects: Record<string, string[]>;
    absence: AbsenceOptions;
};

export function SidebarTimeActions({
    organization,
    isDisabled,
}: {
    organization: Organization;
    isDisabled: boolean;
}) {
    const { t } = useTranslation();
    const { auth } = usePage().props;
    const { id: userId, timezone } = auth.user;
    const storageKey = plusDurationStorageKey(userId, organization.id);
    const [options, setOptions] = useState<ReportOptions | null>(null);
    const [draft, setDraft] = useState<TimeEntryDraft | null>(null);
    const pending = useRef<AbortController | null>(null);

    useEffect(() => () => pending.current?.abort(), []);

    const openReport = async (mode: TimeReportMode) => {
        pending.current?.abort();
        const request = new AbortController();
        pending.current = request;

        try {
            const response = await fetch(reportOptions.url(organization.slug), {
                headers: { Accept: 'application/json' },
                signal: request.signal,
            });
            if (!response.ok) {
                throw new Error(
                    `Report options request failed (${response.status})`,
                );
            }

            const data: ReportOptions = await response.json();
            if (!request.signal.aborted) {
                setOptions(data);
                setDraft(
                    newPlusDraft(
                        newDraft(data.today, [], userId),
                        mode,
                        timezone,
                        storageKey,
                    ),
                );
            }
        } catch {
            if (!request.signal.aborted) {
                toast.danger(t('Something went wrong'));
            }
        } finally {
            if (pending.current === request) {
                pending.current = null;
            }
        }
    };

    return (
        <>
            <TimeActionsMenu
                className="shadow-sm"
                placement="top end"
                testId="sidebar-time-actions"
                isDisabled={isDisabled}
                onStartTimer={
                    organization.timerEnabled
                        ? () => startTimer(organization.slug)
                        : undefined
                }
                onReport={(mode) => void openReport(mode)}
            />
            {options && (
                <TimeEntryForm
                    {...options}
                    draft={draft}
                    onClose={() => setDraft(null)}
                    onCreate={
                        draft?.openedFrom === 'plus'
                            ? (seconds) =>
                                  savePlusDurationMinutes(
                                      storageKey,
                                      Math.round(seconds / 60),
                                  )
                            : undefined
                    }
                />
            )}
        </>
    );
}
