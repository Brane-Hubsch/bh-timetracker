import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import type { Plugin } from 'vite';

const source = 'public/favicon.svg';
const directory = 'resources/app-icons';
const background = '#7c3aed';

async function generateIcons() {
    const artwork = await readFile(source);
    await mkdir(directory, { recursive: true });

    await Promise.all([
        ...[120, 152, 167, 180].map((size) =>
            sharp(artwork, { density: 288 })
                .resize(size, size)
                .flatten({ background })
                .png()
                .toFile(`${directory}/apple-touch-${size}.png`),
        ),
        ...[192, 512].flatMap((size) => {
            // Leave room for platforms to crop the maskable icon into different shapes.
            const padding = Math.round(size * 0.1);
            const inset = size - 2 * padding;

            return [
                sharp(artwork, { density: 288 })
                    .resize(size, size)
                    .png()
                    .toFile(`${directory}/icon-${size}.png`),
                sharp(artwork, { density: 288 })
                    .resize(inset, inset)
                    .flatten({ background })
                    .extend({
                        top: padding,
                        right: padding,
                        bottom: padding,
                        left: padding,
                        background,
                    })
                    .png()
                    .toFile(`${directory}/icon-maskable-${size}.png`),
            ];
        }),
    ]);
}

export function appIcons(): Plugin {
    return {
        name: 'timereport:app-icons',
        async config() {
            await generateIcons();
        },
        async handleHotUpdate({ file, server }) {
            if (file === `${server.config.root}/${source}`) {
                await generateIcons();
            }
        },
    };
}
