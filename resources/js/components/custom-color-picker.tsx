import {
    ColorArea,
    ColorSlider,
    ColorSwatch,
    FieldError,
    InputGroup,
    TextField,
    parseColor,
} from '@heroui/react';
import { colorSwatchPickerVariants } from '@heroui/styles';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { Button } from 'react-aria-components';
import { useTranslation } from '@/lib/i18n';
import type { HexColor } from '@/lib/theme';
import { cn } from '@/lib/utils';

const hexPattern = /\s*#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\s*/;
const hexValue = new RegExp(`^${hexPattern.source}$`);
const swatchSlots = colorSwatchPickerVariants();

function colorHex(color: ReturnType<typeof parseColor>): HexColor {
    return color.toString('hex').toLowerCase() as HexColor;
}

export function CustomColorSwatch({
    value,
    panelId,
    isSelected,
    isExpanded,
    isDisabled,
    className,
    onPress,
}: {
    value: string;
    panelId: string;
    isSelected: boolean;
    isExpanded: boolean;
    isDisabled?: boolean;
    className?: string;
    onPress: () => void;
}) {
    const { t } = useTranslation();

    return (
        <Button
            type="button"
            aria-label={t('Custom colour')}
            aria-description={isSelected ? value : undefined}
            aria-pressed={isSelected}
            aria-expanded={isExpanded}
            aria-controls={isExpanded ? panelId : undefined}
            data-selected={isSelected}
            className={cn(swatchSlots.item(), className)}
            isDisabled={isDisabled}
            style={{ '--color-swatch-current': value } as CSSProperties}
            onPress={onPress}
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
    );
}

export function CustomColorPanel({
    id,
    initialValue,
    onChange,
    onCommit,
}: {
    id: string;
    initialValue: string;
    onChange?: (value: HexColor) => void;
    onCommit?: (value: HexColor) => void;
}) {
    const { t } = useTranslation();
    const [color, setColor] = useState(() => parseColor(initialValue));
    const [hex, setHex] = useState(initialValue);

    const changeColor = (next: ReturnType<typeof parseColor>) => {
        const nextHex = colorHex(next);
        setColor(next);
        setHex(nextHex);
        onChange?.(nextHex);
    };
    const commitColor = (next: ReturnType<typeof parseColor>) =>
        onCommit?.(colorHex(next));
    const commitShorthand = () => {
        if (hexValue.test(hex) && hex.trim().replace(/^#/, '').length === 3) {
            commitColor(color);
        }
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
                onChangeEnd={onCommit ? commitColor : undefined}
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
                    onChangeEnd={onCommit ? commitColor : undefined}
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
                            const digits = next.trim().replace(/^#/, '');
                            const parsed = parseColor(`#${digits}`);
                            setColor(parsed);
                            onChange?.(colorHex(parsed));
                            if (digits.length === 6) {
                                commitColor(parsed);
                            }
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
                            onBlur={onCommit ? commitShorthand : undefined}
                            onKeyDown={
                                onCommit
                                    ? (event) => {
                                          if (event.key === 'Enter') {
                                              commitShorthand();
                                          }
                                      }
                                    : undefined
                            }
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
