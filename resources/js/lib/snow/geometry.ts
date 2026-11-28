/**
 * Sizes shared by the simulation, the shaders and the tools, in CSS pixels.
 */
export const SNOW_BLOWER = {
    /** The space it takes up on the ground, and the size of its button. */
    width: 108,
    height: 78,
    /** Pixels per unit of the model. */
    scale: 70,
    /** How far in front of the housing the auger reaches. */
    intake: 12,
    /** From the right edge of the screen to the parked snowblower. */
    parkedRight: 64,
    minElevation: 0.45,
    maxElevation: 1.35,
    defaultElevation: 0.95,
} as const;

export const SNOW_SHOVEL = {
    /** From the grip in the hand to the edge of the blade. */
    length: 88,
    /** Half the width of the blade. */
    reach: 18,
    /** Where the parked shovel's grip is (from the right edge, above the snow) and how it leans. */
    parked: { right: 34, above: 76, angle: -0.14 },
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
