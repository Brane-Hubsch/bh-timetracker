import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
import { useTranslation } from '@/lib/i18n';

const options = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
] as const;

export default function AppearanceTabs() {
    const { t } = useTranslation();
    const { appearance, updateAppearance } = useAppearance();

    return (
        <ToggleButtonGroup
            aria-label={t('Appearance')}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[appearance]}
            onSelectionChange={(keys) => {
                const [value] = [...keys];

                if (value) {
                    updateAppearance(value as Appearance);
                }
            }}
        >
            {options.map(({ value, icon: Icon, label }, index) => (
                <ToggleButton key={value} id={value}>
                    {index > 0 && <ToggleButtonGroup.Separator />}
                    <Icon className="size-4" />
                    {t(label)}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}
