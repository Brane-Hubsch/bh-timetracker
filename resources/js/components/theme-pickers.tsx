import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import type { Key } from '@heroui/react';
import { Building2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { SegmentedControl } from '@/components/segmented-control';
import { useAppearance } from '@/hooks/use-appearance';
import { useTranslation } from '@/lib/i18n';
import { ACCENTS, THEMES, accentColorsFor, isCustomAccent } from '@/lib/theme';
import type {
    AccentColor,
    AccentName,
    ContrastPreference,
    ThemeName,
} from '@/lib/theme';

const ORGANIZATION = 'organization';

function useAccentColor() {
    const { resolvedAppearance } = useAppearance();

    return (accent: AccentColor): string => {
        const colors = accentColorsFor(accent);

        return resolvedAppearance === 'dark' ? colors.dark : colors.light;
    };
}

export function accentLabel(accent: AccentName): string {
    return ACCENTS.find(({ id }) => id === accent)?.label ?? accent;
}

/**
 * Theme cards with a small preview of the theme in the current light or dark mode.
 */
export function ThemePicker({
    value,
    accent,
    onChange,
    'aria-describedby': describedBy,
}: {
    value: ThemeName;
    /** Accent shown in the previews. */
    accent: AccentColor;
    onChange: (theme: ThemeName) => void;
    'aria-describedby'?: string;
}) {
    const { t } = useTranslation();
    const { resolvedAppearance } = useAppearance();
    const accentColor = useAccentColor()(accent);
    const isDark = resolvedAppearance === 'dark';

    return (
        <ToggleButtonGroup
            aria-label={t('Theme')}
            aria-describedby={describedBy}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set<Key>([value])}
            onSelectionChange={(keys) => {
                const [key] = [...keys];

                if (key !== undefined) {
                    onChange(String(key) as ThemeName);
                }
            }}
            isDetached
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            data-test="theme-picker"
        >
            {THEMES.map((theme) => {
                const colors = isDark ? theme.dark : theme.light;
                const previewAccent = theme.accent
                    ? isDark || theme.alwaysDark
                        ? theme.accent.dark
                        : theme.accent.light
                    : accentColor;

                return (
                    <ToggleButton
                        key={theme.id}
                        id={theme.id}
                        aria-label={t(theme.label)}
                        className="group h-auto w-full min-w-0 flex-col items-stretch gap-2.5 rounded-2xl border border-separator bg-surface p-2 pb-3 text-start whitespace-normal transition-colors data-[selected=true]:border-accent data-[selected=true]:ring-1 data-[selected=true]:ring-accent"
                    >
                        <span
                            aria-hidden="true"
                            className="relative flex h-20 overflow-hidden rounded-[0.625rem]"
                            style={{ backgroundColor: colors.background }}
                        >
                            <span
                                className="grid w-8 content-start gap-1.5 p-2"
                                style={{ backgroundColor: colors.sidebar }}
                            >
                                {[0, 1, 2].map((line) => (
                                    <span
                                        key={line}
                                        className="h-1 rounded-full opacity-50"
                                        style={{
                                            backgroundColor: colors.muted,
                                        }}
                                    />
                                ))}
                            </span>
                            <span
                                className="m-3 grid flex-1 content-start gap-1.5 border p-2"
                                style={{
                                    backgroundColor: colors.surface,
                                    borderColor: colors.border,
                                    borderRadius: theme.radius,
                                }}
                            >
                                <span
                                    className="h-1 w-3/5 rounded-full"
                                    style={{
                                        backgroundColor: colors.foreground,
                                    }}
                                />
                                <span
                                    className="h-1 w-4/5 rounded-full"
                                    style={{ backgroundColor: colors.muted }}
                                />
                                <span
                                    className="mt-1 h-2 w-8"
                                    style={{
                                        backgroundColor: previewAccent,
                                        borderRadius: theme.radius / 2,
                                    }}
                                />
                            </span>
                        </span>
                        <span className="flex items-center gap-2 px-1">
                            <span
                                aria-hidden="true"
                                className="size-4 shrink-0 rounded-full border-[1.5px] border-muted group-data-[selected=true]:border-[5px] group-data-[selected=true]:border-accent"
                            />
                            <span className="grid min-w-0">
                                <span className="truncate text-sm font-medium text-foreground">
                                    {t(theme.label)}
                                </span>
                                <span className="text-xs font-normal text-muted">
                                    {t(theme.description)}
                                </span>
                            </span>
                        </span>
                    </ToggleButton>
                );
            })}
        </ToggleButtonGroup>
    );
}

/**
 * Round colour swatches. With `organizationAccent`, the first swatch follows the organization (null).
 */
export function AccentPicker({
    value,
    onChange,
    organizationAccent,
    customSwatch,
    'aria-label': ariaLabel,
    'aria-describedby': describedBy,
    'data-test': dataTest,
    isDisabled = false,
}: {
    value: AccentColor | null;
    onChange: (accent: AccentName | null) => void;
    organizationAccent?: AccentName;
    customSwatch?: ReactNode;
    isDisabled?: boolean;
    'aria-label': string;
    'aria-describedby'?: string;
    'data-test'?: string;
}) {
    const { t } = useTranslation();
    const accentColor = useAccentColor();
    const selected = value ?? (organizationAccent ? ORGANIZATION : 'violet');
    const swatchClass =
        'size-10 min-w-0 rounded-full border-2 border-transparent bg-transparent p-[3px] transition-colors data-[selected=true]:border-accent';

    return (
        <ToggleButtonGroup
            aria-label={ariaLabel}
            aria-describedby={describedBy}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set<Key>(isCustomAccent(value) ? [] : [selected])}
            onSelectionChange={(keys) => {
                const [key] = [...keys];

                if (key !== undefined) {
                    onChange(
                        key === ORGANIZATION
                            ? null
                            : (String(key) as AccentName),
                    );
                }
            }}
            isDetached
            isDisabled={isDisabled}
            className="flex flex-wrap items-center gap-2"
            data-test={dataTest}
        >
            {organizationAccent && (
                <>
                    <ToggleButton
                        id={ORGANIZATION}
                        isIconOnly
                        aria-label={t("Organization's colour (:color)", {
                            color: t(accentLabel(organizationAccent)),
                        })}
                        className={swatchClass}
                    >
                        <span
                            aria-hidden="true"
                            className="grid size-full place-items-center rounded-full text-white dark:text-black/80"
                            style={{
                                backgroundColor:
                                    accentColor(organizationAccent),
                            }}
                        >
                            <Building2 className="size-4" />
                        </span>
                    </ToggleButton>
                    <span
                        aria-hidden="true"
                        className="mx-1 h-6 w-px bg-separator"
                    />
                </>
            )}
            {ACCENTS.map((accent) => (
                <ToggleButton
                    key={accent.id}
                    id={accent.id}
                    isIconOnly
                    aria-label={t(accent.label)}
                    className={swatchClass}
                >
                    <span
                        aria-hidden="true"
                        className="size-full rounded-full"
                        style={{ backgroundColor: accentColor(accent.id) }}
                    />
                </ToggleButton>
            ))}
            {customSwatch}
        </ToggleButtonGroup>
    );
}

export function ContrastPicker({
    value,
    onChange,
    'aria-describedby': describedBy,
}: {
    value: ContrastPreference;
    onChange: (contrast: ContrastPreference) => void;
    'aria-describedby'?: string;
}) {
    const { t } = useTranslation();

    return (
        <SegmentedControl
            aria-label={t('Contrast')}
            aria-describedby={describedBy}
            className="w-fit"
            value={value}
            onChange={onChange}
            options={[
                { id: 'system', label: t('Device setting') },
                { id: 'normal', label: t('Normal') },
                { id: 'more', label: t('High') },
            ]}
            data-test="contrast-picker"
        />
    );
}
