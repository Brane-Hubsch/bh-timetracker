/** Compare tag names the same way as Tag::normalize on the server. */
export function normalizeTagName(name: string): string {
    return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}
