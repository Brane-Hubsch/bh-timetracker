import { Head, router, usePage } from '@inertiajs/react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import AppearanceTabs from '@/components/appearance-tabs';
import Heading from '@/components/heading';
import {
    AccentPicker,
    accentLabel,
    ContrastPicker,
    ThemePicker,
} from '@/components/theme-pickers';
import { useTranslation } from '@/lib/i18n';
import { applyThemePreferences } from '@/lib/theme';
import type { ThemePreferences } from '@/lib/theme';
import {
    edit as editAppearance,
    update as updateAppearance,
} from '@/routes/appearance';

function Setting({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: (descriptionId: string) => ReactNode;
}) {
    const descriptionId = useId();

    return (
        <section className="grid gap-3">
            <div className="grid gap-0.5">
                <h3 className="text-sm font-medium text-foreground">{title}</h3>
                <p id={descriptionId} className="text-xs text-muted">
                    {description}
                </p>
            </div>
            {children(descriptionId)}
        </section>
    );
}

export default function Appearance() {
    const { t } = useTranslation();
    const { theme: saved, currentOrganization } = usePage().props;
    const [preferences, setPreferences] = useState<ThemePreferences>(saved);

    const save = (changes: Partial<ThemePreferences>) => {
        const next = { ...preferences, ...changes };
        next.accent = next.ownAccent ?? next.organizationAccent;
        setPreferences(next);
        // Show the change at once; the saved values come back with the response.
        applyThemePreferences(next);

        const data: Record<string, string | null> = {};
        if ('theme' in changes) {
            data.theme = next.theme;
        }
        if ('ownAccent' in changes) {
            data.accent = next.ownAccent;
        }
        if ('contrast' in changes) {
            data.contrast = next.contrast;
        }

        router.patch(updateAppearance.url(), data, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    return (
        <>
            <Head title={t('Appearance')} />

            <section className="grid gap-8">
                <Heading
                    variant="small"
                    title={t('Appearance')}
                    description={t(
                        'Choose mode, theme and colours. The theme, colour and contrast follow your account.',
                    )}
                />

                <Setting
                    title={t('Mode')}
                    description={t('Saved on this device.')}
                >
                    {() => <AppearanceTabs />}
                </Setting>

                <Setting
                    title={t('Theme')}
                    description={t('Colours of the background and surfaces.')}
                >
                    {(descriptionId) => (
                        <ThemePicker
                            value={preferences.theme}
                            accent={preferences.accent}
                            onChange={(theme) => save({ theme })}
                            aria-describedby={descriptionId}
                        />
                    )}
                </Setting>

                <Setting
                    title={t('Accent colour')}
                    description={
                        currentOrganization
                            ? t(
                                  "Buttons, selections and links. The organization's colour unless you choose your own.",
                              )
                            : t('Buttons, selections and links.')
                    }
                >
                    {(descriptionId) => (
                        <div className="grid gap-2">
                            <AccentPicker
                                aria-label={t('Accent colour')}
                                aria-describedby={descriptionId}
                                value={preferences.ownAccent}
                                organizationAccent={
                                    currentOrganization
                                        ? preferences.organizationAccent
                                        : undefined
                                }
                                onChange={(ownAccent) => save({ ownAccent })}
                                data-test="accent-picker"
                            />
                            <p
                                className="text-xs text-muted"
                                aria-live="polite"
                            >
                                {preferences.ownAccent === null &&
                                currentOrganization
                                    ? t("Organization's colour · :color", {
                                          color: t(
                                              accentLabel(
                                                  preferences.organizationAccent,
                                              ),
                                          ),
                                      })
                                    : t(accentLabel(preferences.accent))}
                            </p>
                        </div>
                    )}
                </Setting>

                <Setting
                    title={t('Contrast')}
                    description={t(
                        'High contrast gives clearer borders and darker text. The device setting follows your system.',
                    )}
                >
                    {(descriptionId) => (
                        <ContrastPicker
                            value={preferences.contrast}
                            onChange={(contrast) => save({ contrast })}
                            aria-describedby={descriptionId}
                        />
                    )}
                </Setting>
            </section>
        </>
    );
}

Appearance.layout = {
    breadcrumbs: [
        {
            title: 'Appearance',
            href: editAppearance(),
        },
    ],
};
