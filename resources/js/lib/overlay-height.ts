// Observe the HeroUI surfaces themselves, including overlays rendered into portals.
const overlaySelector = [
    '[data-slot="modal-dialog"]',
    '[data-slot="alert-dialog-dialog"]',
    '[data-slot="drawer-dialog"]',
    '[data-slot="sheet-dialog"]',
    '[data-slot="autocomplete-popover"]',
    '[data-slot="combo-box-popover"]',
    '[data-slot="date-picker-popover"]',
    '[data-slot="date-range-picker-popover"]',
    '[data-slot="dropdown-popover"]',
    '[data-slot="select-popover"]',
    '.popover',
    '.tooltip',
].join(', ');

type Overlay = {
    height: number;
    animation?: Animation;
};

const exiting = '[data-exiting="true"]';

export function observeOverlayHeights() {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const overlays = new Map<HTMLElement, Overlay>();
    const easing =
        getComputedStyle(document.documentElement)
            .getPropertyValue('--ease-out-soft')
            .trim() || 'ease-out';

    function stop(element: HTMLElement, overlay: Overlay) {
        overlay.animation?.cancel();
        overlay.animation = undefined;
        element.removeAttribute('data-overlay-resizing');
    }

    function update(element: HTMLElement, overlay: Overlay) {
        if (element.closest(exiting)) {
            stop(element, overlay);
            return;
        }

        // Computed CSS height is independent of the transform used to open the overlay.
        const style = getComputedStyle(element);
        const current = parseFloat(style.height);
        const effect = overlay.animation?.effect as KeyframeEffect | undefined;
        let height = current;

        if (effect) {
            // Read the layout without the current animation, then resume it if its target still fits.
            effect.target = null;
            height = parseFloat(style.height);
            effect.target = element;
        }

        const target = overlay.height;
        overlay.height = height;

        if (!Number.isFinite(height) || height === 0 || !target) {
            stop(element, overlay);
            return;
        }

        if (height === target) {
            return;
        }

        const previous = effect ? current : target;
        stop(element, overlay);
        if (height === previous) {
            return;
        }

        if (style.overflowX === 'visible' && style.overflowY === 'visible') {
            element.setAttribute('data-overlay-resizing', '');
        }

        const animation = element.animate(
            { height: [`${previous}px`, `${height}px`] },
            { duration: 240, easing, fill: 'backwards' },
        );
        overlay.animation = animation;
        animation.onfinish = () => {
            stop(element, overlay);
            update(element, overlay);
        };
    }

    const resizeObserver = new ResizeObserver((entries) => {
        for (const { target } of entries) {
            const element = target as HTMLElement;
            const overlay = overlays.get(element);
            if (overlay && !overlay.animation) {
                update(element, overlay);
            }
        }
    });

    function register(element: Element) {
        if (element instanceof HTMLElement && !overlays.has(element)) {
            overlays.set(element, {
                height: parseFloat(getComputedStyle(element).height),
            });
            resizeObserver.observe(element, { box: 'border-box' });
        }
    }

    const mutationObserver = new MutationObserver((records) => {
        const changed = new Set<HTMLElement>();
        for (const record of records) {
            const target =
                record.target instanceof Element
                    ? record.target
                    : record.target.parentElement;
            const surface = target?.closest<HTMLElement>(overlaySelector);
            if (surface) {
                changed.add(surface);
            }

            if (record.attributeName === 'data-exiting') {
                target
                    ?.querySelectorAll<HTMLElement>(overlaySelector)
                    .forEach((element) => {
                        changed.add(element);
                    });
            }

            for (const node of record.addedNodes) {
                if (node instanceof Element && node.isConnected) {
                    if (node.matches(overlaySelector)) {
                        register(node);
                    }
                    node.querySelectorAll(overlaySelector).forEach(register);
                }
            }
        }

        for (const [element, overlay] of overlays) {
            if (!element.isConnected) {
                stop(element, overlay);
                resizeObserver.unobserve(element);
                overlays.delete(element);
            } else if (changed.has(element)) {
                update(element, overlay);
            }
        }
    });

    function disconnect() {
        mutationObserver.disconnect();
        resizeObserver.disconnect();
        for (const [element, overlay] of overlays) {
            stop(element, overlay);
        }
        overlays.clear();
    }

    function syncPreference() {
        if (motion.matches) {
            disconnect();
            return;
        }

        document.querySelectorAll(overlaySelector).forEach(register);
        mutationObserver.observe(document.body, {
            subtree: true,
            childList: true,
            characterData: true,
            attributeFilter: ['class', 'style', 'hidden', 'data-exiting'],
        });
    }

    syncPreference();
    motion.addEventListener('change', syncPreference);
    return () => {
        motion.removeEventListener('change', syncPreference);
        disconnect();
    };
}
