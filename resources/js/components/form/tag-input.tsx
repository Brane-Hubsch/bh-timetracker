import {
    Button,
    CloseButton,
    ComboBox,
    FieldError,
    Label,
    ListBox,
} from '@heroui/react';
import type { KeyboardEvent, Key } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Group, Input } from 'react-aria-components';
import addTagIcon from '@/assets/tag-add.svg';
import removeTagIcon from '@/assets/tag-remove.svg';
import { useTranslation } from '@/lib/i18n';

type Props = {
    /** Selected tag names. */
    value: string[];
    onChange: (value: string[]) => void;
    /** Existing tag names to suggest. */
    suggestions: string[];
    recentTags: string[];
    max?: number;
    error?: string;
};

const CREATE = '__create__';

function normalize(name: string): string {
    return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function TagIcon({ src }: { src: string }) {
    return (
        <span
            aria-hidden="true"
            className="block size-3 shrink-0 bg-muted mask-center mask-no-repeat"
            style={{ maskImage: `url("${src}")` }}
        />
    );
}

function RecentTagShortcuts({
    names,
    onAdd,
}: {
    names: string[];
    onAdd: (name: string) => void;
}) {
    const { t } = useTranslation();
    const viewport = useRef<HTMLDivElement>(null);
    const [fadeLeft, setFadeLeft] = useState(false);
    const [fadeRight, setFadeRight] = useState(false);

    useEffect(() => {
        const element = viewport.current;
        const row = element?.firstElementChild;

        if (!element || !row) {
            return;
        }

        const updateFades = () => {
            const { scrollLeft, scrollWidth, clientWidth } = element;
            setFadeLeft(scrollLeft > 1);
            setFadeRight(scrollWidth - clientWidth - scrollLeft > 1);
        };

        const observer = new ResizeObserver(updateFades);
        observer.observe(element);
        observer.observe(row);
        element.addEventListener('scroll', updateFades, { passive: true });

        return () => {
            observer.disconnect();
            element.removeEventListener('scroll', updateFades);
        };
    }, []);

    const leftFadeWidth = fadeLeft ? '1.5rem' : '0px';
    const rightFadeWidth = fadeRight ? '1.5rem' : '0px';

    return (
        <div
            ref={viewport}
            role="group"
            aria-label={t('Recently used tags')}
            className="min-w-0 scroll-px-6 [scrollbar-width:none] overflow-x-auto"
            style={{
                maskImage:
                    fadeLeft || fadeRight
                        ? `linear-gradient(to right, transparent, black ${leftFadeWidth}, black calc(100% - ${rightFadeWidth}), transparent)`
                        : undefined,
            }}
        >
            <div className="flex w-max gap-1.5 p-px">
                {names.map((name) => (
                    <Button
                        key={name}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 min-w-8 gap-1.5 rounded-full pr-2 pl-[9px] text-xs font-normal whitespace-nowrap text-foreground inset-ring-1 inset-ring-separator data-[focus-visible=true]:ring-0 data-[focus-visible=true]:inset-ring-2 data-[focus-visible=true]:inset-ring-focus data-[focus-visible=true]:ring-offset-0"
                        onPress={() => onAdd(name)}
                    >
                        {name}
                        <TagIcon src={addTagIcon} />
                    </Button>
                ))}
            </div>
        </div>
    );
}

/**
 * Pick tags from the organization's list or type a new one (Enter or comma adds it). Existing tags
 * are matched case-insensitively, so "möte" picks "Möte" instead of creating a duplicate.
 */
export function TagInput({
    value,
    onChange,
    suggestions,
    recentTags,
    max = 10,
    error,
}: Props) {
    const { t } = useTranslation();
    const [input, setInput] = useState('');
    const selected = new Set(value.map(normalize));
    const query = normalize(input);
    const available = suggestions.filter(
        (name) =>
            !selected.has(normalize(name)) && normalize(name).includes(query),
    );
    const exists = suggestions.some((name) => normalize(name) === query);
    const isFull = value.length >= max;
    const shortcuts = recentTags.filter(
        (name) => !selected.has(normalize(name)),
    );

    const add = (name: string) => {
        const clean = name.trim().replace(/\s+/g, ' ');

        if (clean !== '' && !selected.has(normalize(clean)) && !isFull) {
            // Prefer the existing spelling ("Möte") over what was typed ("möte").
            const existing = suggestions.find(
                (suggestion) => normalize(suggestion) === normalize(clean),
            );
            onChange([...value, existing ?? clean]);
        }

        setInput('');
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        // With an option highlighted, the combo box picks it; otherwise add what was typed.
        const hasActiveOption = Boolean(
            event.currentTarget.getAttribute('aria-activedescendant'),
        );

        if ((event.key === 'Enter' || event.key === ',') && input.trim()) {
            if (event.key === ',' || !hasActiveOption) {
                event.preventDefault();
                add(input);
            }
        }

        if (event.key === 'Backspace' && input === '' && value.length > 0) {
            onChange(value.slice(0, -1));
        }
    };

    const items = [
        ...available.map((name) => ({ id: name, label: name })),
        ...(query !== '' && !exists && !selected.has(query)
            ? [
                  {
                      id: CREATE,
                      label: t('Create tag ":name"', { name: input.trim() }),
                  },
              ]
            : []),
    ];

    return (
        <div className="grid min-w-0 gap-2" data-test="tag-input">
            <ComboBox
                allowsCustomValue
                inputValue={input}
                onInputChange={setInput}
                selectedKey={null}
                onSelectionChange={(key: Key | null) => {
                    if (key !== null) {
                        add(key === CREATE ? input : String(key));
                    }
                }}
                items={isFull ? [] : items}
                isDisabled={isFull}
                isInvalid={Boolean(error)}
                menuTrigger="input"
                className="w-full gap-2"
            >
                <Label>{t('Tags')}</Label>
                <Group className="flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-field border border-field-border bg-field px-2 py-1 focus-within:ring-2 focus-within:ring-focus data-[invalid=true]:border-danger data-[invalid=true]:focus-within:ring-danger">
                    {value.length > 0 && (
                        <ul
                            aria-label={t('Tags')}
                            className="flex max-w-full min-w-0 flex-wrap gap-1.5"
                        >
                            {value.map((name) => (
                                <li
                                    key={name}
                                    className="flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full bg-default pr-2 pl-[9px] text-xs text-foreground"
                                >
                                    <span className="min-w-0 truncate">
                                        {name}
                                    </span>
                                    <CloseButton
                                        slot={null}
                                        aria-label={t('Remove tag :name', {
                                            name,
                                        })}
                                        className="touch-target size-3 rounded-full bg-transparent p-0"
                                        onPress={() =>
                                            onChange(
                                                value.filter(
                                                    (tag) => tag !== name,
                                                ),
                                            )
                                        }
                                    >
                                        <TagIcon src={removeTagIcon} />
                                    </CloseButton>
                                </li>
                            ))}
                        </ul>
                    )}
                    <Input
                        placeholder={
                            isFull
                                ? t('At most :max tags', { max })
                                : t('Add a tag')
                        }
                        onKeyDown={onKeyDown}
                        className="min-w-0 grow basis-28 bg-transparent text-base text-field-foreground outline-none placeholder:text-muted disabled:opacity-50 sm:text-sm"
                    />
                </Group>
                <FieldError>{error}</FieldError>
                <ComboBox.Popover>
                    <ListBox>
                        {(item: { id: string; label: string }) => (
                            <ListBox.Item id={item.id} textValue={item.label}>
                                {item.label}
                            </ListBox.Item>
                        )}
                    </ListBox>
                </ComboBox.Popover>
            </ComboBox>

            {!isFull && shortcuts.length > 0 && (
                <RecentTagShortcuts names={shortcuts} onAdd={add} />
            )}
        </div>
    );
}
