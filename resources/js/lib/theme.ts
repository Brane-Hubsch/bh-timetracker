/**
 * Themes, accent colours and contrast. The colours themselves live in app.css as CSS variables keyed by
 * data attributes on <html>; the hex values here are only for previews and the browser's theme colour.
 */
export type ThemeName = 'standard' | 'sand' | 'slate' | 'graphite';
export type AccentName =
    | 'violet'
    | 'blue'
    | 'teal'
    | 'green'
    | 'orange'
    | 'pink'
    | 'neutral';
export type ContrastPreference = 'system' | 'normal' | 'more';

export type ThemePreferences = {
    theme: ThemeName;
    /** The colour in use: the person's own, else the organization's. */
    accent: AccentName;
    /** The person's own accent, or null to follow the organization. */
    ownAccent: AccentName | null;
    organizationAccent: AccentName;
    contrast: ContrastPreference;
};

type PreviewColors = {
    background: string;
    sidebar: string;
    surface: string;
    foreground: string;
    muted: string;
    border: string;
};

export const THEMES: {
    id: ThemeName;
    label: string;
    description: string;
    radius: number;
    light: PreviewColors;
    dark: PreviewColors;
}[] = [
    {
        id: 'standard',
        label: 'Standard',
        description: 'The original look',
        radius: 8,
        light: {
            background: '#f5f5f5',
            sidebar: '#efeff0',
            surface: '#ffffff',
            foreground: '#18181b',
            muted: '#606067',
            border: '#dedee0',
        },
        dark: {
            background: '#060607',
            sidebar: '#232325',
            surface: '#18181b',
            foreground: '#fcfcfc',
            muted: '#a4a4ac',
            border: '#28282c',
        },
    },
    {
        id: 'sand',
        label: 'Sand',
        description: 'Warm, soft tones',
        radius: 10,
        light: {
            background: '#f7f2ea',
            sidebar: '#f1ece3',
            surface: '#fefdf9',
            foreground: '#251c16',
            muted: '#675b51',
            border: '#dfd8ce',
        },
        dark: {
            background: '#0e0c09',
            sidebar: '#26221d',
            surface: '#1c1915',
            foreground: '#f7f3eb',
            muted: '#afa69a',
            border: '#322d27',
        },
    },
    {
        id: 'slate',
        label: 'Slate',
        description: 'Cool blue-grey tones',
        radius: 8,
        light: {
            background: '#f0f4f9',
            sidebar: '#e8edf3',
            surface: '#fbfdfe',
            foreground: '#141c27',
            muted: '#535f6e',
            border: '#d2dae2',
        },
        dark: {
            background: '#070c15',
            sidebar: '#1a222e',
            surface: '#111923',
            foreground: '#f0f4f9',
            muted: '#9ba9bb',
            border: '#262e3b',
        },
    },
    {
        id: 'graphite',
        label: 'Graphite',
        description: 'Neutral and crisp',
        radius: 4,
        light: {
            background: '#fafafa',
            sidebar: '#f2f2f2',
            surface: '#ffffff',
            foreground: '#121212',
            muted: '#5b5b5b',
            border: '#d7d7d7',
        },
        dark: {
            background: '#020202',
            sidebar: '#181818',
            surface: '#0e0e0e',
            foreground: '#f5f5f5',
            muted: '#a4a4a4',
            border: '#242424',
        },
    },
];

export const ACCENTS: {
    id: AccentName;
    label: string;
    light: string;
    dark: string;
}[] = [
    { id: 'violet', label: 'Violet', light: '#7e41ed', dark: '#9b70ff' },
    { id: 'blue', label: 'Blue', light: '#0064dc', dark: '#51a2f8' },
    { id: 'teal', label: 'Teal', light: '#007176', dark: '#2cc5c5' },
    { id: 'green', label: 'Green', light: '#137738', dark: '#47c86e' },
    { id: 'orange', label: 'Orange', light: '#b64a02', dark: '#f39340' },
    { id: 'pink', label: 'Pink', light: '#cd167b', dark: '#f379ad' },
    { id: 'neutral', label: 'Neutral', light: '#242424', dark: '#e4e4e4' },
];

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
    theme: 'standard',
    accent: 'violet',
    ownAccent: null,
    organizationAccent: 'violet',
    contrast: 'system',
};

const contrastQuery = (): MediaQueryList | null =>
    typeof window === 'undefined'
        ? null
        : window.matchMedia('(prefers-contrast: more)');

let current: ThemePreferences = DEFAULT_THEME_PREFERENCES;

/**
 * Put the theme on <html> and give the browser chrome the accent colour.
 */
export function applyThemePreferences(preferences: ThemePreferences): void {
    if (typeof document === 'undefined') {
        return;
    }

    current = preferences;
    const root = document.documentElement;
    const isHighContrast =
        preferences.contrast === 'more' ||
        (preferences.contrast === 'system' &&
            contrastQuery()?.matches === true);

    root.dataset.palette = preferences.theme;
    root.dataset.accent = preferences.accent;
    root.dataset.contrast = isHighContrast ? 'more' : 'normal';

    const accent = ACCENTS.find(({ id }) => id === preferences.accent);
    const themeColor = document.querySelector('meta[name="theme-color"]');

    if (accent && themeColor) {
        themeColor.setAttribute('content', accent.light);
    }
}

/**
 * Follow the device's contrast setting while the preference is "system".
 */
export function watchSystemContrast(): void {
    contrastQuery()?.addEventListener('change', () =>
        applyThemePreferences(current),
    );
}
