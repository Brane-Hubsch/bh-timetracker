import { Label, Switch } from '@heroui/react';
import { Head, usePage } from '@inertiajs/react';
import { Play, Plus, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import Heading from '@/components/heading';
import { ReorderableList } from '@/components/reorderable-list';
import {
    useSidebarOrder,
    useSidebarSettings,
} from '@/hooks/use-sidebar-settings';
import { useTranslation } from '@/lib/i18n';
import { useMainNavigation } from '@/lib/navigation';
import { cn } from '@/lib/utils';

const cardClass =
    'divide-y divide-separator rounded-xl border border-separator bg-surface';

function SidebarSetting({
    title,
    icon: Icon,
    visible,
    onChange,
    grip,
    available = true,
}: {
    title: string;
    icon: LucideIcon;
    visible: boolean;
    onChange: (visible: boolean) => void;
    grip?: ReactNode;
    available?: boolean;
}) {
    const { t } = useTranslation();

    return (
        <div
            className={cn(
                'flex items-center gap-3 pe-4',
                grip ? 'ps-3' : 'ps-4',
            )}
        >
            {grip && (
                <div className={cn(!visible && '[&_svg]:opacity-65')}>
                    {grip}
                </div>
            )}
            <Switch
                className="min-w-0 flex-1"
                isSelected={available && visible}
                isDisabled={!available}
                onChange={onChange}
            >
                <Switch.Content className="min-h-14 w-full justify-between gap-3">
                    <Label
                        className={cn(
                            'flex min-w-0 items-center gap-3 text-sm font-medium',
                            visible ? 'text-foreground' : 'text-muted',
                        )}
                    >
                        <Icon aria-hidden="true" className="size-4 shrink-0" />
                        <span className="truncate">{t(title)}</span>
                    </Label>
                    <Switch.Control className="shrink-0">
                        <Switch.Thumb />
                    </Switch.Control>
                </Switch.Content>
            </Switch>
        </div>
    );
}

export default function Sidebar() {
    const { t } = useTranslation();
    const { currentOrganization } = usePage().props;
    const items = useMainNavigation();
    const { orderKey, isVisible, setVisible } = useSidebarSettings();
    const { order, byTitle, move } = useSidebarOrder(orderKey, items);

    return (
        <>
            <Head title={t('Sidebar')} />

            <section className="grid gap-6">
                <Heading variant="small" title={t('Sidebar')} />

                <div className={cardClass}>
                    <SidebarSetting
                        title="Search"
                        icon={Search}
                        visible={isVisible('Search')}
                        onChange={(visible) => setVisible('Search', visible)}
                    />
                </div>

                {order.length > 0 && (
                    <ReorderableList
                        key={JSON.stringify([
                            orderKey,
                            items.map(({ title }) => title),
                        ])}
                        items={order}
                        move={move}
                        label={t('Menu links')}
                        showGrips
                        className={cardClass}
                        rowClassName="first:rounded-t-xl last:rounded-b-xl data-[lifted=true]:rounded-xl data-[lifted=true]:bg-surface"
                        renderItem={(title, grip) => (
                            <SidebarSetting
                                title={title}
                                icon={byTitle.get(title)!.icon}
                                visible={isVisible(title)}
                                onChange={(visible) =>
                                    setVisible(title, visible)
                                }
                                grip={grip}
                            />
                        )}
                    />
                )}

                <div className={cardClass}>
                    <SidebarSetting
                        title="Report time"
                        icon={Plus}
                        available={Boolean(currentOrganization)}
                        visible={isVisible('Report time')}
                        onChange={(visible) =>
                            setVisible('Report time', visible)
                        }
                    />
                    <SidebarSetting
                        title="Start timer"
                        icon={Play}
                        available={Boolean(currentOrganization?.timerEnabled)}
                        visible={isVisible('Start timer')}
                        onChange={(visible) =>
                            setVisible('Start timer', visible)
                        }
                    />
                </div>
            </section>
        </>
    );
}
