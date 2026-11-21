import { usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';

export default function AppLogo() {
    const { name } = usePage().props;

    return (
        <span className="flex items-center gap-2">
            <AppLogoIcon size={32} />
            <span className="truncate text-sm font-semibold">{name}</span>
        </span>
    );
}
