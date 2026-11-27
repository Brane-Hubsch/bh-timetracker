import { Button, buttonVariants } from '@heroui/react';
import { Head, Link, usePage } from '@inertiajs/react';
import { useTranslation } from '@/lib/i18n';
import { home } from '@/routes';

type Props = {
    status: 403 | 404 | 429 | 500 | 503;
};

/**
 * Shown for HTTP errors in production (see AppServiceProvider::configureErrorPages).
 */
export default function ErrorPage({ status }: Props) {
    const { t } = useTranslation();
    const { name } = usePage().props;

    const messages: Record<
        Props['status'],
        { title: string; description: string }
    > = {
        403: {
            title: t('No access'),
            description: t('You do not have permission to see this page.'),
        },
        404: {
            title: t('Page not found'),
            description: t('The page does not exist or has been moved.'),
        },
        429: {
            title: t('Too many requests'),
            description: t('Wait a minute and try again.'),
        },
        500: {
            title: t('Something went wrong'),
            description: t(
                'An error occurred on our side. It has been logged; please try again in a moment.',
            ),
        },
        503: {
            title: t('Down for maintenance'),
            description: t('We are updating :app. Back in a few minutes.', {
                app: name,
            }),
        },
    };
    const message = messages[status] ?? messages[500];

    return (
        <>
            <Head title={message.title} />

            <div className="grid gap-2 text-center" data-test="error-page">
                <p className="text-sm font-medium text-muted tabular-nums">
                    {status}
                </p>
                <h1 className="text-lg font-semibold">{message.title}</h1>
                <p className="text-sm text-muted">{message.description}</p>
            </div>

            <div className="grid gap-2">
                <Link
                    href={home()}
                    className={buttonVariants({ fullWidth: true })}
                >
                    {t('Go to start page')}
                </Link>
                <Button
                    variant="ghost"
                    fullWidth
                    onPress={() => window.history.back()}
                >
                    {t('Go back')}
                </Button>
            </div>
        </>
    );
}
