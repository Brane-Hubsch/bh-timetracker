<script
    id="umami-tracker"
    defer
    src="{{ config('services.umami.script_url') }}"
    data-website-id="{{ config('services.umami.website_id') }}"
    data-domains="{{ config('services.umami.domain') }}"
    data-auto-track="false"
    referrerpolicy="no-referrer"
></script>
<script>
    (() => {
        let previousPath;
        let previousUrl;
        const referrerOrigin = document.referrer && new URL(document.referrer).origin;
        const externalReferrer = referrerOrigin === location.origin || referrerOrigin === 'null'
            ? ''
            : referrerOrigin;

        function trackPage() {
            if (!window.umami) return;

            // Magic links and invitations carry credentials in their paths.
            const pathname = location.pathname.replace(/^\/(login\/link|invitations)\/.*$/, '/$1');
            if (pathname === previousPath) return;

            // Keep client and project names out of tracked URLs and referrers.
            const path = pathname.replace(/^(\/[^/]+\/(?:clients|projects))\/[^/]+/, '$1/:record');
            const url = location.origin + path;

            const referrer = previousUrl ?? externalReferrer;
            previousPath = pathname;
            previousUrl = url;

            // Page titles can contain client and project names.
            window.umami.track((payload) => ({ ...payload, url, referrer, title: undefined }));
        }

        document.getElementById('umami-tracker').addEventListener('load', trackPage);
        document.addEventListener('inertia:navigate', trackPage);
        window.addEventListener('pageshow', (event) => {
            if (event.persisted) {
                previousPath = undefined;
                previousUrl = undefined;
                trackPage();
            }
        });
    })();
</script>
