import { ColorSwatchPicker, Label } from '@heroui/react';
import { useId, useState } from 'react';
import {
    CustomColorPanel,
    CustomColorSwatch,
} from '@/components/custom-color-picker';
import { useTranslation } from '@/lib/i18n';

type Props = {
    colors: string[];
    value: string;
    onChange: (value: string) => void;
    error?: string;
};

export function ProjectColorPicker({ colors, value, onChange, error }: Props) {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const [hasChosenCustom, setHasChosenCustom] = useState(false);
    const panelId = useId();
    const isCustomSelected =
        hasChosenCustom || !colors.includes(value.toLowerCase());

    return (
        <div className="grid gap-2">
            <Label>{t('Colour')}</Label>
            <div className="relative grid grid-cols-[repeat(auto-fill,2rem)] gap-2">
                {/* Reserve the preset slots so the separate disclosure wraps with the swatches. */}
                {colors.map((color) => (
                    <span key={color} aria-hidden="true" className="size-8" />
                ))}
                <ColorSwatchPicker
                    aria-label={t('Colour')}
                    className="pointer-events-none absolute inset-0 content-start"
                    // A transparent value leaves the opaque presets unselected in custom mode.
                    value={isCustomSelected ? '#00000000' : value}
                    onChange={(color) => {
                        onChange(color.toString('hex').toLowerCase());
                        setHasChosenCustom(false);
                        setIsExpanded(false);
                    }}
                >
                    {colors.map((color) => (
                        <ColorSwatchPicker.Item
                            key={color}
                            color={color}
                            className="pointer-events-auto"
                        >
                            <ColorSwatchPicker.Swatch />
                            <ColorSwatchPicker.Indicator />
                        </ColorSwatchPicker.Item>
                    ))}
                </ColorSwatchPicker>
                <CustomColorSwatch
                    value={value}
                    panelId={panelId}
                    isSelected={isCustomSelected}
                    isExpanded={isExpanded}
                    onPress={() => {
                        setHasChosenCustom(true);
                        setIsExpanded(!isExpanded);
                    }}
                />
            </div>

            {isExpanded && (
                <CustomColorPanel
                    id={panelId}
                    initialValue={value}
                    onChange={onChange}
                />
            )}
            {error && (
                <p className="text-sm text-danger" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
