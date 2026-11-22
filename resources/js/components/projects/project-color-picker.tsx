import {
    Button,
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
import { useId, useState } from 'react';
import { useTranslation } from '@/lib/i18n';

const hexPattern = /\s*#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\s*/;
const hexValue = new RegExp(`^${hexPattern.source}$`);

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
                <Button
                    type="button"
                    variant="ghost"
                    isIconOnly
                    aria-label={t('Custom colour')}
                    aria-description={isCustomSelected ? value : undefined}
                    aria-pressed={isCustomSelected}
                    aria-expanded={isExpanded}
                    aria-controls={isExpanded ? panelId : undefined}
                    className="group relative size-8 min-w-0 shrink-0 rounded-full border-2 border-transparent p-0 aria-pressed:border-accent"
                    onPress={() => {
                        setHasChosenCustom(true);
                        setIsExpanded(!isExpanded);
                    }}
                >
                    <span
                        aria-hidden="true"
                        className="size-7 rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] group-aria-pressed:scale-[0.77]"
                    />
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
            className="grid w-full max-w-[20.5rem] grid-cols-[minmax(0,1.25fr)_minmax(7.25rem,1fr)] items-center gap-3 rounded-2xl border border-separator bg-surface-secondary p-3"
        >
            <div className="grid grid-cols-[minmax(0,1fr)_1.25rem] gap-3">
                <ColorArea
                    aria-label={t('Colour area')}
                    colorSpace="hsb"
                    xChannel="saturation"
                    yChannel="brightness"
                    value={color}
                    onChange={changeColor}
                >
                    <ColorArea.Thumb />
                </ColorArea>
                <ColorSlider
                    aria-label={t('Hue')}
                    channel="hue"
                    colorSpace="hsb"
                    orientation="vertical"
                    value={color}
                    onChange={changeColor}
                >
                    <ColorSlider.Track>
                        <ColorSlider.Thumb />
                    </ColorSlider.Track>
                </ColorSlider>
            </div>
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
            >
                <Label>{t('Hex code')}</Label>
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
                <FieldError>
                    {t('Enter a valid hex colour, e.g. #3478cc.')}
                </FieldError>
            </TextField>
        </div>
    );
}
