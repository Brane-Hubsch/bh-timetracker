import {
    ComboBox,
    FieldError,
    Header,
    Input,
    Label,
    ListBox,
    ToggleButton,
    ToggleButtonGroup,
} from '@heroui/react';
import { ProjectDot } from '@/components/project-dot';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useTranslation } from '@/lib/i18n';
import type { ProjectOption } from '@/types';

type Props = {
    projects: ProjectOption[];
    value: string;
    onChange: (projectId: string) => void;
    error?: string;
    autoFocus?: boolean;
    /** Recently used project ids, newest first; overrides `isRecent` (e.g. for another member). */
    recentIds?: string[];
};

function ProjectItem({ project }: { project: ProjectOption }) {
    return (
        <ListBox.Item id={project.value} textValue={project.label}>
            <ProjectDot color={project.color} />
            <div className="min-w-0">
                <Label className="truncate">{project.label}</Label>
                {project.clientName && (
                    <span className="block truncate text-xs text-muted">
                        {project.clientName}
                    </span>
                )}
            </div>
            <ListBox.ItemIndicator />
        </ListBox.Item>
    );
}

/**
 * Searchable project picker with the user's recently used projects first, and the same projects as
 * one-tap shortcuts below the field so the common case needs no dropdown.
 */
export function ProjectPicker({
    projects,
    value,
    onChange,
    error,
    autoFocus,
    recentIds,
}: Props) {
    const { t } = useTranslation();
    const isDesktop = useIsDesktop();
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
                className="w-full"
                menuTrigger="focus"
                data-test="project-picker"
            >
                <Label>{t('Project')}</Label>
                <ComboBox.InputGroup>
                    <Input
                        placeholder={t('Search projects')}
                        autoFocus={focusSearch}
                    />
                    <ComboBox.Trigger />
                </ComboBox.InputGroup>
                <FieldError>{error}</FieldError>
                <ComboBox.Popover>
                    <ListBox>
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
                    </ListBox>
                </ComboBox.Popover>
            </ComboBox>

            {recent.length > 0 && (
                <ToggleButtonGroup
                    aria-label={t('Recently used')}
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={value === '' ? new Set() : new Set([value])}
                    onSelectionChange={(keys) => {
                        const [key] = [...keys];

                        if (key !== undefined) {
                            onChange(String(key));
                        }
                    }}
                    isDetached
                    size="sm"
                    className="flex flex-wrap justify-start gap-1.5"
                    data-test="recent-projects"
                >
                    {recent.map((project) => (
                        <ToggleButton
                            key={project.value}
                            id={project.value}
                            className="max-w-full gap-1.5 rounded-full border border-separator bg-transparent px-3 text-foreground transition-colors data-[selected=true]:border-accent data-[selected=true]:bg-accent/10"
                        >
                            <ProjectDot color={project.color} />
                            <span className="max-w-40 truncate">
                                {project.label}
                            </span>
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            )}
        </div>
    );
}
