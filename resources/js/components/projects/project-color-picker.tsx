import {
    Button,
    ColorArea,
    ColorSlider,
    ColorSwatchPicker,
    FieldError,
    Input,
    Label,
    TextField,
    parseColor,
} from '@heroui/react';
import { Check, Plus } from 'lucide-react';
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
    const panelId = useId();
    const isCustom = !colors.includes(value.toLowerCase());
    const rgb = parseColor(value);
    const isLight =
        rgb.getChannelValue('red') * 0.2126 +
            rgb.getChannelValue('green') * 0.7152 +
            rgb.getChannelValue('blue') * 0.0722 >
        127.5;

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
                    value={rgb}
                    onChange={(color) => {
                        onChange(color.toString('hex').toLowerCase());
                        setIsExpanded(false);
                    }}
                >
                    {colors.map((color) => (
                        <ColorSwatchPicker.Item
                            key={color}
                            color={color}
                            className="pointer-events-auto"
                            onPress={() => setIsExpanded(false)}
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
                    aria-label={
                        isCustom
                            ? t('Custom colour (:hex)', { hex: value })
                            : t('Custom colour')
                    }
                    aria-expanded={isExpanded}
                    aria-controls={isExpanded ? panelId : undefined}
                    className="relative size-8 min-w-0 shrink-0 rounded-full border-2 border-transparent p-0"
                    style={isCustom ? { borderColor: value } : undefined}
                    onPress={() => setIsExpanded(!isExpanded)}
                >
                    {isCustom ? (
                        <span
                            aria-hidden="true"
                            className="grid size-[22px] place-items-center rounded-full"
                            style={{
                                backgroundColor: value,
                                color: isLight ? 'black' : 'white',
                            }}
                        >
                            <Check className="size-3" />
                        </span>
                    ) : (
                        <span
                            aria-hidden="true"
                            className="grid size-7 place-items-center rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]"
                        >
                            <span className="grid size-4 place-items-center rounded-full bg-white text-zinc-950">
                                <Plus className="size-3" />
                            </span>
                        </span>
                    )}
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
        <div id={id} className="grid w-full max-w-56 gap-3">
            <ColorArea
                aria-label={t('Colour area')}
                className="h-32"
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
            >
                <Label>{t('Hex code')}</Label>
                <Input
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                />
                <FieldError>
                    {t('Enter a valid hex colour, e.g. #3478cc.')}
                </FieldError>
            </TextField>
        </div>
    );
}
