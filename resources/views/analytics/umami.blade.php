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
        let previousUrl;
        const referrerOrigin = document.referrer && new URL(document.referrer).origin;
        const externalReferrer = referrerOrigin === location.origin || referrerOrigin === 'null'
            ? ''
            : referrerOrigin;

        function trackPage() {
            if (!window.umami) return;

            // Magic links and invitations carry credentials in their paths.
            const path = location.pathname.replace(/^\/(login\/link|invitations)\/.*$/, '/$1');
            const url = location.origin + path;
            if (url === previousUrl) return;

            const referrer = previousUrl ?? externalReferrer;
            previousUrl = url;

            // Page titles can contain client and project names.
            window.umami.track((payload) => ({ ...payload, url, referrer, title: undefined }));
        }

        document.getElementById('umami-tracker').addEventListener('load', trackPage);
        document.addEventListener('inertia:navigate', trackPage);
        window.addEventListener('pageshow', (event) => {
            if (event.persisted) {
                previousUrl = undefined;
                trackPage();
            }
        });
    })();
</script>
