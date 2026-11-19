import {
    Autocomplete,
    Description,
    EmptyState,
    Header,
    Kbd,
    Label,
    ListBox,
    Modal,
    SearchField,
    useFilter,
} from '@heroui/react';
import { router, usePage } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    FileUp,
    Briefcase,
    Building2,
    CalendarDays,
    ChartColumn,
    CircleUserRound,
    Clock,
    CopyPlus,
    FolderKanban,
    FolderPlus,
    House,
    KeyRound,
    List,
    LogOut,
    Monitor,
    Moon,
    Palette,
    Plus,
    Sparkles,
    Sun,
    Tags,
    Target,
    UserPlus,
    UserRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { createContext, use, useCallback, useEffect, useState } from 'react';
import { LogoImage } from '@/components/logo-image';
import { ProjectDot } from '@/components/project-dot';
import { logoutAndFlush } from '@/components/user-menu';
import { useAppearance } from '@/hooks/use-appearance';
import { useSwitchOrganization } from '@/hooks/use-switch-organization';
import { useTranslation } from '@/lib/i18n';
import { commandPalette, dashboard } from '@/routes';
import { edit as editAiConnections } from '@/routes/ai-connections';
import { edit as editAppearance } from '@/routes/appearance';
import { index as clientsIndex, show as showClient } from '@/routes/clients';
import { edit as editOrganization } from '@/routes/organizations';
import { create as createImport } from '@/routes/organizations/import';
import { edit as editProfile } from '@/routes/profile';
import { index as projectsIndex, show as showProject } from '@/routes/projects';
import {
    detailed as detailedReport,
    projects as projectFollowUp,
    summary as reportSummary,
} from '@/routes/reports';
import { edit as editSecurity } from '@/routes/security';
import { index as timeIndex } from '@/routes/time';

type PaletteData = {
    projects: {
        id: number;
        name: string;
        code: string | null;
        color: string;
        clientName: string | null;
    }[];
    clients: { id: number; name: string }[];
    members: { id: number; name: string }[];
};

type Command = {
    id: string;
    label: string;
    description?: string;
    /** Extra words to match on (searched together with the label). */
    keywords?: string;
    icon?: LucideIcon;
    color?: string;
    /** An organization's logo (or initial) instead of an icon. */
    logo?: { src: string | null | undefined; name: string };
    perform: () => void;
};

type Section = { id: string; title: string; commands: Command[] };

const CommandPaletteContext = createContext<{ open: () => void }>({
    open: () => {},
});

/** Open the command palette from a button (e.g. the sidebar search field). */
export function useCommandPalette(): { open: () => void } {
    return use(CommandPaletteContext);
}

export const isMac = (): boolean =>
    typeof navigator !== 'undefined' &&
    /mac|iphone|ipad/i.test(navigator.userAgent);

/** "⌘ K" on Apple devices, "Ctrl K" elsewhere. */
export function CommandPaletteShortcut({ className }: { className?: string }) {
    return (
        <Kbd className={className} variant="light">
            <Kbd.Abbr keyValue={isMac() ? 'command' : 'ctrl'} />
            <Kbd.Content>K</Kbd.Content>
        </Kbd>
    );
}

/**
 * ⌘K / Ctrl+K command palette: navigation, quick actions and search for projects, clients and
 * members. Searchable items load from the server the first time the palette opens.
 */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
    const [isOpen, setOpen] = useState(false);
    const open = useCallback(() => setOpen(true), []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (
                event.key.toLowerCase() === 'k' &&
                (event.metaKey || event.ctrlKey) &&
                !event.altKey &&
                !event.shiftKey
            ) {
                event.preventDefault();
                setOpen((current) => !current);
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    return (
        <CommandPaletteContext value={{ open }}>
            {children}
            <CommandPalette isOpen={isOpen} onOpenChange={setOpen} />
        </CommandPaletteContext>
    );
}

function CommandPalette({
    isOpen,
    onOpenChange,
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}) {
    const { t } = useTranslation();
    const { contains } = useFilter({ sensitivity: 'base' });
    const [query, setQuery] = useState('');
    const sections = useCommandSections(isOpen, query);
    const commands = new Map(
        sections.flatMap((section) =>
            section.commands.map((command) => [command.id, command] as const),
        ),
    );

    const run = (id: string) => {
        const command = commands.get(id);

        onOpenChange(false);
        setQuery('');
        command?.perform();
    };

    return (
        <Modal.Backdrop
            isOpen={isOpen}
            onOpenChange={(next) => {
                onOpenChange(next);

                if (!next) {
                    setQuery('');
                }
            }}
            isDismissable
        >
            <Modal.Container placement="top" className="pt-[10vh]">
                <Modal.Dialog
                    aria-label={t('Command palette')}
                    className="overflow-hidden p-0 sm:max-w-xl"
                    data-test="command-palette"
                >
                    <Autocomplete.Filter
                        filter={contains}
                        inputValue={query}
                        onInputChange={setQuery}
                    >
                        <div className="border-b border-separator p-3">
                            <SearchField
                                autoFocus
                                aria-label={t('Search or run a command')}
                                className="w-full"
                            >
                                <SearchField.Group>
                                    <SearchField.SearchIcon />
                                    <SearchField.Input
                                        placeholder={t(
                                            'Search or run a command…',
                                        )}
                                        data-test="command-palette-input"
                                    />
                                    <SearchField.ClearButton />
                                </SearchField.Group>
                            </SearchField>
                        </div>
                        <ListBox
                            aria-label={t('Commands')}
                            selectionMode="none"
                            onAction={(key) => run(String(key))}
                            className="max-h-[60vh] overflow-y-auto p-2"
                            renderEmptyState={() => (
                                <EmptyState className="p-6 text-center text-sm text-muted">
                                    {t('No matching commands.')}
                                </EmptyState>
                            )}
                        >
                            {sections.map((section) => (
                                <ListBox.Section
                                    key={section.id}
                                    id={section.id}
                                >
                                    <Header>{section.title}</Header>
                                    {section.commands.map((command) => (
                                        <ListBox.Item
                                            key={command.id}
                                            id={command.id}
                                            textValue={`${command.label} ${command.description ?? ''} ${command.keywords ?? ''}`}
                                            data-test={`command-${command.id}`}
                                        >
                                            <span className="flex size-5 shrink-0 items-center justify-center text-muted">
                                                {command.logo ? (
                                                    <LogoImage
                                                        src={command.logo.src}
                                                        name={command.logo.name}
                                                        size={20}
                                                        className="rounded-md"
                                                    />
                                                ) : command.color ? (
                                                    <ProjectDot
                                                        color={command.color}
                                                    />
                                                ) : (
                                                    command.icon && (
                                                        <command.icon className="size-4" />
                                                    )
                                                )}
                                            </span>
                                            <div className="flex min-w-0 flex-col">
                                                <Label className="truncate">
                                                    {command.label}
                                                </Label>
                                                {command.description && (
                                                    <Description className="truncate">
                                                        {command.description}
                                                    </Description>
                                                )}
                                            </div>
                                        </ListBox.Item>
                                    ))}
                                </ListBox.Section>
                            ))}
                        </ListBox>
                    </Autocomplete.Filter>
                    <div className="hidden items-center gap-3 border-t border-separator px-4 py-2 text-xs text-muted sm:flex">
                        <span>
                            {t('↑↓ to move, Enter to run, Esc to close')}
                        </span>
                        <CommandPaletteShortcut className="ms-auto" />
                    </div>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}

/**
 * Everything the palette offers, filtered by the user's permissions. Projects, clients and members
 * only show up once the user types, so the default list stays short.
 */
function useCommandSections(isOpen: boolean, query: string): Section[] {
    const { t } = useTranslation();
    const { currentOrganization, organizations, can } = usePage().props;
    const { updateAppearance } = useAppearance();
    const switchOrganization = useSwitchOrganization();
    const [data, setData] = useState<PaletteData | null>(null);
    const [loadedFor, setLoadedFor] = useState<string | null>(null);
    const slug = currentOrganization?.slug;

    useEffect(() => {
        if (!isOpen || !slug || loadedFor === slug) {
            return;
        }

        setLoadedFor(slug);
        fetch(commandPalette.url(slug), {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((json: PaletteData | null) => setData(json))
            .catch(() => setData(null));
    }, [isOpen, slug, loadedFor]);

    if (!slug) {
        return [];
    }

    const go = (url: string) => () => router.visit(url);
    const searching = query.trim() !== '';
    const time = (query: Record<string, string | number>) =>
        timeIndex.url(slug, { query });
    const report = (period: string) =>
        reportSummary.url(slug, { query: { period } });

    const sections: Section[] = [
        {
            id: 'actions',
            title: t('Quick actions'),
            commands: [
                {
                    id: 'report-time',
                    label: t('Report time'),
                    keywords: t('new entry add hours'),
                    icon: Plus,
                    perform: go(time({ new: 1 })),
                },
                {
                    id: 'copy-week',
                    label: t('Copy previous week'),
                    icon: CopyPlus,
                    perform: go(time({ copy: 1 })),
                },
                ...(can?.canManageProjects
                    ? [
                          {
                              id: 'new-project',
                              label: t('New project'),
                              icon: FolderPlus,
                              perform: go(
                                  projectsIndex.url(slug, {
                                      query: { new: 1 },
                                  }),
                              ),
                          },
                      ]
                    : []),
                ...(can?.canManageClients
                    ? [
                          {
                              id: 'new-client',
                              label: t('New client'),
                              icon: Briefcase,
                              perform: go(
                                  clientsIndex.url(slug, {
                                      query: { new: 1 },
                                  }),
                              ),
                          },
                      ]
                    : []),
                ...(can?.canCreateInvitation
                    ? [
                          {
                              id: 'invite-member',
                              label: t('Invite member'),
                              icon: UserPlus,
                              perform: go(
                                  editOrganization.url(slug, {
                                      query: { invite: 1 },
                                  }),
                              ),
                          },
                      ]
                    : []),
            ],
        },
        {
            id: 'navigation',
            title: t('Go to'),
            commands: [
                {
                    id: 'go-dashboard',
                    label: t('Today'),
                    keywords: t('dashboard start'),
                    icon: House,
                    perform: go(dashboard.url(slug)),
                },
                {
                    id: 'go-calendar',
                    label: t('Calendar'),
                    keywords: t('week time'),
                    icon: CalendarDays,
                    perform: go(time({ view: 'week' })),
                },
                {
                    id: 'go-time-list',
                    label: t('Time list'),
                    icon: List,
                    perform: go(time({ view: 'list' })),
                },
                {
                    id: 'go-reports',
                    label: t('Reports'),
                    icon: ChartColumn,
                    perform: go(reportSummary.url(slug)),
                },
                {
                    id: 'go-detailed',
                    label: t('Detailed report'),
                    icon: List,
                    perform: go(detailedReport.url(slug)),
                },
                {
                    id: 'go-follow-up',
                    label: t('Project follow-up'),
                    keywords: t('estimate'),
                    icon: Target,
                    perform: go(projectFollowUp.url(slug)),
                },
                {
                    id: 'go-projects',
                    label: t('Projects'),
                    icon: FolderKanban,
                    perform: go(projectsIndex.url(slug)),
                },
                ...(can?.canManageClients
                    ? [
                          {
                              id: 'go-clients',
                              label: t('Clients'),
                              icon: Briefcase,
                              perform: go(clientsIndex.url(slug)),
                          },
                      ]
                    : []),
                {
                    id: 'go-profile',
                    label: t('Profile'),
                    keywords: t('settings account name'),
                    icon: CircleUserRound,
                    perform: go(editProfile.url()),
                },
                {
                    id: 'go-security',
                    label: t('Security'),
                    keywords: t('passkeys'),
                    icon: KeyRound,
                    perform: go(editSecurity.url()),
                },
                {
                    id: 'go-organization',
                    label: t('Organization settings'),
                    keywords: t('members rates invitations'),
                    icon: Building2,
                    perform: go(editOrganization.url(slug)),
                },
                ...(can?.canManageTags
                    ? [
                          {
                              id: 'go-tags',
                              label: t('Tags'),
                              keywords: t('rename merge'),
                              icon: Tags,
                              perform: go(`${editOrganization.url(slug)}#tags`),
                          },
                      ]
                    : []),
                ...(can?.canManageClients &&
                can.canManageProjects &&
                can.canManageTeamTime
                    ? [
                          {
                              id: 'go-import',
                              label: t('Import from Clockify'),
                              keywords: t('csv clockify import'),
                              icon: FileUp,
                              perform: go(createImport.url(slug)),
                          },
                      ]
                    : []),
                {
                    id: 'go-ai',
                    label: t('AI connections'),
                    keywords: t('mcp claude'),
                    icon: Sparkles,
                    perform: go(editAiConnections.url()),
                },
                {
                    id: 'go-appearance',
                    label: t('Appearance'),
                    icon: Palette,
                    perform: go(editAppearance.url()),
                },
            ],
        },
        {
            id: 'reports',
            title: t('Reports'),
            commands: [
                ['this_week', t('Report: this week')],
                ['last_week', t('Report: last week')],
                ['this_month', t('Report: this month')],
                ['last_month', t('Report: last month')],
                ['this_year', t('Report: this year')],
            ].map(([period, label]) => ({
                id: `report-${period}`,
                label,
                icon: ChartColumn,
                perform: go(report(period)),
            })),
        },
    ];

    if (searching && data) {
        sections.push(
            {
                id: 'projects',
                title: t('Projects'),
                commands: data.projects.flatMap((project) => {
                    const description = [project.clientName, project.code]
                        .filter(Boolean)
                        .join(' · ');

                    return [
                        {
                            id: `project-${project.id}`,
                            label: project.name,
                            description: description || undefined,
                            color: project.color,
                            perform: go(
                                showProject.url({ project: project.id }),
                            ),
                        },
                        {
                            id: `project-${project.id}-report`,
                            label: t('Report time on :project', {
                                project: project.name,
                            }),
                            description: description || undefined,
                            icon: Clock,
                            perform: go(time({ new: 1, project: project.id })),
                        },
                    ];
                }),
            },
            {
                id: 'clients',
                title: t('Clients'),
                commands: data.clients.map((client) => ({
                    id: `client-${client.id}`,
                    label: client.name,
                    icon: Briefcase,
                    perform: go(showClient.url({ client: client.id })),
                })),
            },
            {
                id: 'members',
                title: t('Members'),
                commands: data.members.map((member) => ({
                    id: `member-${member.id}`,
                    label: t('Show time for :name', { name: member.name }),
                    icon: UserRound,
                    perform: go(time({ user: member.id })),
                })),
            },
        );
    }

    const otherOrganizations = organizations.filter(
        (organization) => organization.slug !== slug,
    );

    sections.push(
        ...(otherOrganizations.length > 0
            ? [
                  {
                      id: 'organizations',
                      title: t('Switch organization'),
                      commands: otherOrganizations.map((organization) => ({
                          id: `organization-${organization.slug}`,
                          label: t('Switch to :name', {
                              name: organization.name,
                          }),
                          logo: {
                              src: organization.logo,
                              name: organization.name,
                          },
                          perform: () => switchOrganization(organization),
                      })),
                  },
              ]
            : []),
        {
            id: 'theme',
            title: t('Appearance'),
            commands: [
                {
                    id: 'theme-light',
                    label: t('Light theme'),
                    icon: Sun,
                    perform: () => updateAppearance('light'),
                },
                {
                    id: 'theme-dark',
                    label: t('Dark theme'),
                    icon: Moon,
                    perform: () => updateAppearance('dark'),
                },
                {
                    id: 'theme-system',
                    label: t('System theme'),
                    icon: Monitor,
                    perform: () => updateAppearance('system'),
                },
            ],
        },
        {
            id: 'account',
            title: t('Account'),
            commands: [
                {
                    id: 'logout',
                    label: t('Log out'),
                    keywords: t('sign out'),
                    icon: LogOut,
                    perform: () => logoutAndFlush(),
                },
            ],
        },
    );

    return sections.filter((section) => section.commands.length > 0);
}
