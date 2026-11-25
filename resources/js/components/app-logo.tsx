import AppLogoIcon from '@/components/app-logo-icon';
import { useTranslation } from '@/lib/i18n';

export default function AppLogo() {
    const { t } = useTranslation();

    return (
        <span className="flex items-center gap-2">
            <AppLogoIcon size={32} />
            <span className="truncate text-sm font-semibold">
                {t('TimeTracker')}
            </span>
        </span>
    );
}
