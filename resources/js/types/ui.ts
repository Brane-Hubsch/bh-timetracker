import type { ReactNode } from 'react';
import type { BreadcrumbItem } from '@/types/navigation';

/** Content width: `default` for lists, detail pages and forms; `wide` for the calendar and reports. */
export type ContentWidth = 'default' | 'wide';

export type AppLayoutProps = {
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
    width?: ContentWidth;
    compact?: boolean;
};

export type AppVariant = 'header' | 'sidebar';

export type FlashToast = {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    /** URL to POST to undo the action (e.g. restore a deleted entry). */
    undo?: string;
};

export type AuthLayoutProps = {
    children?: ReactNode;
    name?: string;
    title?: string;
    description?: string;
};
