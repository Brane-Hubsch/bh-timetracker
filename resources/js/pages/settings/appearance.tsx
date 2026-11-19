import { Head } from '@inertiajs/react';
import AppearanceTabs from '@/components/appearance-tabs';
import Heading from '@/components/heading';
import { useTranslation } from '@/lib/i18n';
import { edit as editAppearance } from '@/routes/appearance';

export default function Appearance() {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Appearance')} />

            <section className="grid gap-6">
                <Heading
                    variant="small"
                    title={t('Appearance')}
                    description={t('Choose light, dark or follow your device.')}
                />
                <AppearanceTabs />
            </section>
        </>
    );
}

Appearance.layout = {
    breadcrumbs: [
        {
            title: 'Appearance',
            href: editAppearance(),
        },
    ],
};
