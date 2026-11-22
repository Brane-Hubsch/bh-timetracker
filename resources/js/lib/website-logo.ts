export type WebsiteLogo = {
    image: string;
    mime: string;
    source: 'apple-touch' | 'favicon';
};

/** Turn the selected icon into a regular PNG for the existing logo upload flow. */
export async function prepareWebsiteLogo(logo: WebsiteLogo): Promise<File> {
    const bytes = Uint8Array.from(atob(logo.image), (byte) =>
        byte.charCodeAt(0),
    );
    const url = URL.createObjectURL(new Blob([bytes], { type: logo.mime }));

    try {
        const image = new Image();
        image.src = url;
        await image.decode();

        const canvas = document.createElement('canvas');
        const side = 128;
        canvas.width = canvas.height = side;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Could not prepare the website logo');
        }

        const small = Math.min(image.naturalWidth, image.naturalHeight) < 64;
        const limit = small ? 72 : logo.source === 'apple-touch' ? side : 104;
        const scale = Math.min(
            limit / Math.max(image.naturalWidth, image.naturalHeight),
            small ? 3 : Infinity,
        );
        const width = Math.round(image.naturalWidth * scale);
        const height = Math.round(image.naturalHeight * scale);

        if (small) {
            context.fillStyle = '#eaeaea';
            context.fillRect(0, 0, side, side);
        }
        context.drawImage(
            image,
            (side - width) / 2,
            (side - height) / 2,
            width,
            height,
        );

        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve),
        );
        if (!blob) {
            throw new Error('Could not encode the website logo');
        }

        return new File([blob], 'website-logo.png', { type: 'image/png' });
    } finally {
        URL.revokeObjectURL(url);
    }
}
