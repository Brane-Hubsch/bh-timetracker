export function isAndroidTouch(isTouch: boolean): boolean {
    return isTouch && /Android/i.test(navigator.userAgent);
}

export function vibrateLightly(): void {
    navigator.vibrate?.(10);
}
