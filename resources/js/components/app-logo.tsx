import { usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';

export default function AppLogo() {
    const { name } = usePage().props;

    return (
        <span className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <AppLogoIcon className="size-5" />
            </span>
            <span className="truncate text-sm font-semibold">{name}</span>
        </span>
    );
}
