import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import type { Plugin } from 'vite';

const source = 'public/favicon.svg';
const directory = 'resources/app-icons';
const background = '#7c3aed';

async function generateFavicon(artwork: Buffer) {
    const sizes = [16, 32, 48];
    const images = await Promise.all(
        sizes.map((size) =>
            sharp(artwork, { density: 288 })
                .resize(size, size)
                .png()
                .toBuffer(),
        ),
    );

    // An ICO directory points to each embedded PNG, starting after the header.
    const header = Buffer.alloc(6 + sizes.length * 16);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(sizes.length, 4);

    let offset = header.length;
    images.forEach((image, index) => {
        const entry = 6 + index * 16;
        header[entry] = sizes[index];
        header[entry + 1] = sizes[index];
        header.writeUInt16LE(1, entry + 4);
        header.writeUInt16LE(32, entry + 6);
        header.writeUInt32LE(image.length, entry + 8);
        header.writeUInt32LE(offset, entry + 12);
        offset += image.length;
    });

    await writeFile('public/favicon.ico', Buffer.concat([header, ...images]));
}

async function generateIcons() {
    const artwork = await readFile(source);
    await mkdir(directory, { recursive: true });

    await Promise.all([
        generateFavicon(artwork),
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
