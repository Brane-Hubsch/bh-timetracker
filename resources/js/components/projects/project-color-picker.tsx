import {
    ColorArea,
    ColorSlider,
    ColorSwatch,
    ColorSwatchPicker,
    FieldError,
    InputGroup,
    Label,
    TextField,
    parseColor,
} from '@heroui/react';
import { colorSwatchPickerVariants } from '@heroui/styles';
import type { CSSProperties } from 'react';
import { useId, useState } from 'react';
import { Button } from 'react-aria-components';
import { useTranslation } from '@/lib/i18n';

const hexPattern = /\s*#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\s*/;
const hexValue = new RegExp(`^${hexPattern.source}$`);
const swatchSlots = colorSwatchPickerVariants();

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
                {/* Styled as a swatch item so it selects, hovers and focuses like the presets. */}
                <Button
                    type="button"
                    aria-label={t('Custom colour')}
                    aria-description={isCustomSelected ? value : undefined}
                    aria-pressed={isCustomSelected}
                    aria-expanded={isExpanded}
                    aria-controls={isExpanded ? panelId : undefined}
                    data-selected={isCustomSelected}
                    className={swatchSlots.item()}
                    style={{ '--color-swatch-current': value } as CSSProperties}
                    onPress={() => {
                        setHasChosenCustom(true);
                        setIsExpanded(!isExpanded);
                    }}
                >
                    <span
                        aria-hidden="true"
                        className={`${swatchSlots.swatch()} bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]`}
                    />
                    <span
                        aria-hidden="true"
                        className={`${swatchSlots.indicator()} drop-shadow-[0_0_1.5px_rgb(0_0_0/0.6)]`}
                    >
                        <svg
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            viewBox="0 0 12 12"
                        >
                            <polyline points="2.5 6 5 8.5 9.5 3" />
                        </svg>
                    </span>
                </Button>
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

function CustomColorPanel({
    id,
    initialValue,
    onChange,
}: {
    id: string;
    initialValue: string;
    onChange: Props['onChange'];
}) {
    const { t } = useTranslation();
    const [color, setColor] = useState(() => parseColor(initialValue));
    const [hex, setHex] = useState(initialValue);

    const changeColor = (next: ReturnType<typeof parseColor>) => {
        const nextHex = next.toString('hex').toLowerCase();
        setColor(next);
        setHex(nextHex);
        onChange(nextHex);
    };

    return (
        <div
            id={id}
            className="grid gap-3 rounded-2xl bg-surface-secondary p-3"
        >
            <ColorArea
                aria-label={t('Colour area')}
                className="aspect-auto h-36 max-w-none"
                colorSpace="hsb"
                xChannel="saturation"
                yChannel="brightness"
                value={color}
                onChange={changeColor}
            >
                <ColorArea.Thumb />
            </ColorArea>
            {/* The hex field uses `contents` so its error spans the whole row below the slider. */}
            <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-x-3 gap-y-1">
                <ColorSlider
                    aria-label={t('Hue')}
                    channel="hue"
                    className="w-full"
                    colorSpace="hsb"
                    value={color}
                    onChange={changeColor}
                >
                    <ColorSlider.Track>
                        <ColorSlider.Thumb />
                    </ColorSlider.Track>
                </ColorSlider>
                <TextField
                    value={hex}
                    onChange={(next) => {
                        setHex(next);
                        if (hexValue.test(next)) {
                            const parsed = parseColor(
                                `#${next.trim().replace(/^#/, '')}`,
                            );
                            setColor(parsed);
                            onChange(parsed.toString('hex').toLowerCase());
                        }
                    }}
                    validationBehavior="native"
                    isInvalid={hexValue.test(hex) ? false : undefined}
                    pattern={hexPattern.source}
                    isRequired
                    aria-label={t('Hex code')}
                    className="contents"
                >
                    <InputGroup fullWidth>
                        <InputGroup.Input
                            autoCapitalize="none"
                            autoComplete="off"
                            className="min-w-0"
                            spellCheck={false}
                        />
                        <InputGroup.Suffix className="border-s-0 px-2">
                            <ColorSwatch
                                aria-hidden="true"
                                color={color}
                                shape="square"
                                size="xs"
                            />
                        </InputGroup.Suffix>
                    </InputGroup>
                    <FieldError className="col-span-full">
                        {t('Enter a valid hex colour, e.g. #3478cc.')}
                    </FieldError>
                </TextField>
            </div>
        </div>
    );
}
