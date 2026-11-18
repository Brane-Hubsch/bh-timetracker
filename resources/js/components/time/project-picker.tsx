import {
    ComboBox,
    FieldError,
    Header,
    Input,
    Label,
    ListBox,
} from '@heroui/react';
import { ProjectDot } from '@/components/project-dot';
import { useTranslation } from '@/lib/i18n';
import type { ProjectOption } from '@/types';

type Props = {
    projects: ProjectOption[];
    value: string;
    onChange: (projectId: string) => void;
    error?: string;
    autoFocus?: boolean;
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
 * Searchable project picker with the user's recently used projects first.
 */
export function ProjectPicker({
    projects,
    value,
    onChange,
    error,
    autoFocus,
}: Props) {
    const { t } = useTranslation();
    const recent = projects.filter((project) => project.isRecent);
    const others = projects.filter((project) => !project.isRecent);

    return (
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
                    autoFocus={autoFocus}
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
    );
}
