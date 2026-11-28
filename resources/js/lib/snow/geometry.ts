/**
 * Sizes shared by the simulation, the shaders and the drawings of the tools, in CSS pixels.
 */
export const SNOW_BLOWER = {
    width: 104,
    height: 68,
    /** How far in front of the housing the auger reaches. */
    intake: 12,
    /** The chute turns around this point, from the top left corner when the blower faces right. */
    chutePivot: { x: 73, y: 25 },
    chuteLength: 25,
    minElevation: 0.45,
    maxElevation: 1.35,
    defaultElevation: 0.95,
} as const;

/** Where the snow leaves the chute; it is thrown backwards over the driver. */
export function chuteMouth(
    x: number,
    direction: 1 | -1,
    elevation: number,
    groundY: number,
): { x: number; y: number } {
    const { width, height, chutePivot, chuteLength } = SNOW_BLOWER;
    const pivotX =
        direction === 1 ? x + chutePivot.x : x + width - chutePivot.x;

    return {
        x: pivotX - direction * Math.cos(elevation) * chuteLength,
        y: groundY - height + chutePivot.y - Math.sin(elevation) * chuteLength,
    };
}

export const SNOW_SHOVEL = {
    /** From the grip in the hand to the edge of the blade. */
    length: 88,
    /** Half the width of the blade. */
    reach: 19,
} as const;

/** Radii of the snowman's three balls, bottom to top. */
export const SNOWMAN_RADII = [27, 20, 14] as const;

/** How far each of the three balls has grown (0 to 1) at a given progress. */
export function snowmanGrowth(progress: number): [number, number, number] {
    const ease = (value: number) => {
        const t = Math.max(0, Math.min(1, value));

        return t * t * (3 - 2 * t);
    };

    return [
        ease(progress / 0.5),
        ease((progress - 0.5) / 0.3),
        ease((progress - 0.8) / 0.2),
    ];
}

/** Heights of the three ball centres above the ground; the shaders use the same stacking. */
export function snowmanCentres(
    growth: readonly [number, number, number],
): [number, number, number] {
    const [r1, r2, r3] = SNOWMAN_RADII.map(
        (radius, ball) => radius * growth[ball],
    );
    const c1 = r1 * 0.86;
    const c2 = c1 + r1 * 0.74 + r2 * 0.7;
    const c3 = c2 + r2 * 0.74 + r3 * 0.72;

    return [c1, c2, c3];
}
