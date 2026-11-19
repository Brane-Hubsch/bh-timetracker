import {
    ComboBox,
    FieldError,
    Input,
    Label,
    ListBox,
    Tag,
    TagGroup,
} from '@heroui/react';
import type { Key, KeyboardEvent } from 'react';
import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';

type Props = {
    /** Selected tag names. */
    value: string[];
    onChange: (value: string[]) => void;
    /** Existing tag names to suggest. */
    suggestions: string[];
    max?: number;
    error?: string;
};

const CREATE = '__create__';

function normalize(name: string): string {
    return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/**
 * Pick tags from the organization's list or type a new one (Enter or comma adds it). Existing tags
 * are matched case-insensitively, so "möte" picks "Möte" instead of creating a duplicate.
 */
export function TagInput({
    value,
    onChange,
    suggestions,
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
        <div className="grid gap-2" data-test="tag-input">
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
                items={items}
                isDisabled={isFull}
                isInvalid={Boolean(error)}
                menuTrigger="input"
                className="w-full"
            >
                <Label>{t('Tags')}</Label>
                <ComboBox.InputGroup>
                    <Input
                        placeholder={
                            isFull
                                ? t('At most :max tags', { max })
                                : t('Add a tag')
                        }
                        onKeyDown={onKeyDown}
                    />
                </ComboBox.InputGroup>
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

            {value.length > 0 && (
                <TagGroup
                    aria-label={t('Tags')}
                    size="sm"
                    onRemove={(keys) =>
                        onChange(value.filter((name) => !keys.has(name)))
                    }
                >
                    <TagGroup.List>
                        {value.map((name) => (
                            <Tag key={name} id={name} textValue={name}>
                                {name}
                            </Tag>
                        ))}
                    </TagGroup.List>
                </TagGroup>
            )}
        </div>
    );
}
