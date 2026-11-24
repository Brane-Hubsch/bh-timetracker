import {
    ComboBox,
    FieldError,
    Header,
    Input,
    Label,
    ListBox,
    Switch,
    ToggleButton,
    ToggleButtonGroup,
} from '@heroui/react';
import { Banknote } from 'lucide-react';
import { use, useId, useState } from 'react';
import { ComboBoxStateContext, useFilter } from 'react-aria-components';
import { ShortcutRow } from '@/components/form/shortcut-row';
import { ProjectDot } from '@/components/project-dot';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ProjectOption } from '@/types';

type Props = {
    projects: ProjectOption[];
    value: string;
    onChange: (projectId: string) => void;
    isBillable: boolean;
    onBillableChange: (isBillable: boolean) => void;
    error?: string;
    autoFocus?: boolean;
    createProjectUrl?: string;
    /** Recently used project ids, newest first; overrides `isRecent` (e.g. for another member). */
    recentIds?: string[];
};

function ProjectIdentity({ project }: { project: ProjectOption }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <ProjectDot color={project.color} />
            <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="truncate text-sm leading-6 font-medium text-foreground">
                    {project.label}
                </span>
                {project.clientName && (
                    <>
                        <span aria-hidden="true" className="text-xs text-muted">
                            ·
                        </span>
                        <span className="truncate text-xs leading-5 text-muted">
                            {project.clientName}
                        </span>
                    </>
                )}
            </span>
        </span>
    );
}

function ProjectItem({ project }: { project: ProjectOption }) {
    const { t } = useTranslation();
    const label = [
        project.label,
        project.clientName,
        project.isBillable ? t('Billable by default') : null,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <ListBox.Item
            id={project.value}
            textValue={project.label}
            aria-label={label}
            className="rounded-[1.25rem] px-3 data-selected:bg-default"
        >
            <span className="min-w-0 flex-1">
                <ProjectIdentity project={project} />
            </span>
            <ListBox.ItemIndicator className="static hidden translate-y-0 data-visible:flex" />
            {project.isBillable && (
                <Banknote
                    aria-hidden="true"
                    className="shrink-0 text-muted"
                    size={14}
                />
            )}
        </ListBox.Item>
    );
}

function ProjectInput({
    project,
    autoFocus,
}: {
    project: ProjectOption | undefined;
    autoFocus?: boolean;
}) {
    const { t } = useTranslation();
    const state = use(ComboBoxStateContext);
    // Keep HeroUI's real input and selection state while showing the richer value when closed.
    const showProject =
        project &&
        state?.isOpen === false &&
        state.inputValue === project.label;

    return (
        <ComboBox.InputGroup>
            <Input
                placeholder={t('Search projects')}
                autoFocus={autoFocus}
                className={
                    showProject
                        ? 'text-transparent caret-transparent'
                        : undefined
                }
                // The list opens on typing, Arrow Down or a click, not when the dialog focuses the field.
                onClick={() => {
                    if (state?.isOpen === false) {
                        state.open(null, 'manual');
                    }
                }}
            />
            {showProject && (
                <span
                    aria-hidden="true"
                    className={cn(
                        'pointer-events-none absolute inset-y-0 start-3 end-9 flex items-center',
                        project.isBillable && 'end-14',
                    )}
                >
                    <ProjectIdentity project={project} />
                </span>
            )}
            {showProject && project.isBillable && (
                <Banknote
                    aria-hidden="true"
                    className="pointer-events-none absolute end-9 top-1/2 -translate-y-1/2 text-muted"
                    size={14}
                />
            )}
            <ComboBox.Trigger className="pe-3" />
        </ComboBox.InputGroup>
    );
}

/**
 * Searchable project picker with the user's recently used projects first, and the same projects as
 * one-tap shortcuts below the field until a project is selected.
 */
export function ProjectPicker({
    projects,
    value,
    onChange,
    isBillable,
    onBillableChange,
    error,
    autoFocus,
    createProjectUrl,
    recentIds,
}: Props) {
    const { t } = useTranslation();
    const isDesktop = useIsDesktop();
    const { contains } = useFilter({ sensitivity: 'base' });
    const [query, setQuery] = useState('');
    const selectedProject = projects.find((project) => project.value === value);
    const selectedDescriptionId = useId();
    const selectedDescription = selectedProject
        ? [
              selectedProject.clientName,
              selectedProject.isBillable ? t('Billable by default') : null,
          ]
              .filter(Boolean)
              .join(' · ')
        : '';
    const emptyMessageId = useId();
    const emptyMessage =
        projects.length === 0
            ? t('There are no projects.')
            : t('No projects match your search.');
    const createLabel = t('Create one');
    const showCreate =
        Boolean(createProjectUrl) &&
        !projects.some((project) => contains(project.label, query));
    // The filter receives text only. Give the action its own value, even if a project has the same name.
    let createOptionText = createLabel;
    while (projects.some((project) => project.label === createOptionText)) {
        createOptionText += ' ';
    }
    const recent = recentIds
        ? recentIds.flatMap(
              (id) => projects.find((project) => project.value === id) ?? [],
          )
        : projects.filter((project) => project.isRecent);
    const others = recentIds
        ? projects
              .filter((project) => !recentIds.includes(project.value))
              .sort((a, b) => a.label.localeCompare(b.label))
        : projects.filter((project) => !project.isRecent);
    // On mobile, focusing the search opens the keyboard over the shortcuts; let people tap one instead.
    const focusSearch = autoFocus && (isDesktop || recent.length === 0);

    return (
        <div className="grid gap-2">
            <ComboBox
                selectedKey={value === '' ? null : value}
                onSelectionChange={(key) =>
                    onChange(key === null ? '' : String(key))
                }
                isInvalid={Boolean(error)}
                isRequired
                validationBehavior="aria"
                aria-describedby={
                    selectedDescription ? selectedDescriptionId : undefined
                }
                className="w-full"
                menuTrigger="input"
                allowsEmptyCollection
                onInputChange={setQuery}
                onOpenChange={(isOpen, trigger) => {
                    if (isOpen && trigger !== 'input') {
                        setQuery('');
                    }
                }}
                defaultFilter={(text, input) =>
                    (showCreate && text === createOptionText) ||
                    contains(text, input)
                }
                data-test="project-picker"
            >
                <Label isRequired>{t('Project')}</Label>
                <ProjectInput
                    project={selectedProject}
                    autoFocus={focusSearch}
                />
                <FieldError>{error}</FieldError>
                {selectedDescription && (
                    <span id={selectedDescriptionId} className="sr-only">
                        {selectedDescription}
                    </span>
                )}
                <ComboBox.Popover
                    className={
                        showCreate
                            ? 'flex-row flex-wrap items-center gap-x-1 px-4 py-3'
                            : undefined
                    }
                >
                    {showCreate && (
                        <span
                            id={emptyMessageId}
                            className="leading-6 text-muted"
                        >
                            {emptyMessage}
                        </span>
                    )}
                    <ListBox
                        aria-describedby={
                            showCreate ? emptyMessageId : undefined
                        }
                        className={
                            showCreate
                                ? 'w-fit overflow-visible p-0'
                                : undefined
                        }
                        renderEmptyState={() => (
                            <div className="px-3 py-1.5 text-sm text-muted">
                                {emptyMessage}
                            </div>
                        )}
                    >
                        {recent.length > 0 && (
                            <ListBox.Section>
                                <Header>{t('Recently used')}</Header>
                                {recent.map((project) => (
                                    <ProjectItem
                                        key={project.value}
                                        project={project}
                                    />
                                ))}
                            </ListBox.Section>
                        )}
                        {others.length > 0 && (
                            <ListBox.Section>
                                {recent.length > 0 && (
                                    <Header>{t('All projects')}</Header>
                                )}
                                {others.map((project) => (
                                    <ProjectItem
                                        key={project.value}
                                        project={project}
                                    />
                                ))}
                            </ListBox.Section>
                        )}
                        {showCreate && (
                            <ListBox.Item
                                id="create-project"
                                href={createProjectUrl}
                                textValue={createOptionText}
                                aria-label={t('Create a project')}
                                className="link min-h-0 rounded-sm p-0 text-accent underline decoration-current hover:bg-transparent"
                            >
                                {createLabel}
                            </ListBox.Item>
                        )}
                    </ListBox>
                </ComboBox.Popover>
            </ComboBox>

            {selectedProject && (
                <Switch
                    aria-label={t('Billable')}
                    size="sm"
                    className="w-fit"
                    isSelected={isBillable}
                    onChange={onBillableChange}
                >
                    <Switch.Content className="min-h-5 gap-2">
                        <span className="text-xs font-medium">
                            {t('Billable')}
                        </span>
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                    </Switch.Content>
                </Switch>
            )}

            {!selectedProject && recent.length > 0 && (
                <ShortcutRow data-test="recent-projects">
                    <ToggleButtonGroup
                        aria-label={t('Recently used')}
                        selectionMode="single"
                        disallowEmptySelection
                        selectedKeys={new Set()}
                        onSelectionChange={(keys) => {
                            const [key] = [...keys];

                            if (key !== undefined) {
                                onChange(String(key));
                            }
                        }}
                        isDetached
                        size="sm"
                        className="flex justify-start gap-1.5"
                    >
                        {recent.map((project) => (
                            <ToggleButton
                                key={project.value}
                                id={project.value}
                                className="h-8 max-w-full gap-1.5 rounded-full border border-separator bg-transparent px-3 text-xs font-medium text-foreground transition-colors"
                            >
                                <ProjectDot color={project.color} size="sm" />
                                <span className="max-w-40 truncate">
                                    {project.label}
                                </span>
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                </ShortcutRow>
            )}
        </div>
    );
}
