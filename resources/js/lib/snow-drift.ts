/**
 * Snow that settles along the bottom of the screen and can be shovelled away. The drift is a row of
 * narrow columns with a depth each; landing flakes add to them, neighbouring columns even out like
 * loose snow, and shovelled snow is thrown in the direction of the movement and lands again.
 */
const COLUMN_WIDTH = 4;
const MAX_DEPTH = 44;
/** Largest height difference between neighbouring columns before snow slides down. */
const MAX_SLOPE = 2.4;
const MAX_THROWN = 400;
const SHOVEL_REACH = 26;

type ThrownSnow = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    amount: number;
};

export class SnowDrift {
    private depths = new Float32Array(0);
    private thrown: ThrownSnow[] = [];

    resize(width: number): void {
        const count = Math.ceil(width / COLUMN_WIDTH) + 1;
        if (count === this.depths.length) {
            return;
        }
        const previous = this.depths;
        this.depths = new Float32Array(count);
        for (let column = 0; column < count; column++) {
            const source = Math.floor((column / count) * previous.length);
            this.depths[column] = previous[source] ?? 0;
        }
    }

    /** Depth of the snow at an x position, in CSS pixels. */
    depthAt(x: number): number {
        return this.depths[this.column(x)] ?? 0;
    }

    /** A falling flake settles here; bigger flakes add more snow. */
    land(x: number, radius: number): void {
        const column = this.column(x);
        const amount = 2.4 * radius;
        for (let offset = -4; offset <= 4; offset++) {
            this.add(
                column + offset,
                amount * (1 - Math.abs(offset) / 5) * 0.5,
            );
        }
    }

    /**
     * Push snow away where the shovel moves through the drift. `dx` is the horizontal movement since the
     * last event; the snow flies that way.
     */
    shovel(x: number, y: number, dx: number, height: number): void {
        if (y < height - this.depthAt(x) - 14) {
            return;
        }
        const direction =
            dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx);
        const force = Math.min(Math.abs(dx), 40);
        const first = this.column(x - SHOVEL_REACH);
        const last = this.column(x + SHOVEL_REACH);

        for (let column = first; column <= last; column++) {
            const depth = this.depths[column];
            if (!depth) {
                continue;
            }
            const distance = Math.abs(column * COLUMN_WIDTH - x) / SHOVEL_REACH;
            const taken = Math.min(
                depth,
                (4 + force * 0.25) * (1 - distance * 0.7),
            );
            if (taken <= 0) {
                continue;
            }
            this.depths[column] = depth - taken;

            if (this.thrown.length < MAX_THROWN) {
                this.thrown.push({
                    x: column * COLUMN_WIDTH,
                    y: height - (depth - taken) - 2,
                    vx: direction * (4 + force * 0.35 + Math.random() * 4),
                    vy: -(3 + Math.random() * 4 + force * 0.06),
                    amount: taken,
                });
            }
        }
    }

    /** Let thrown snow fly and land, and loose snow slide down slopes. */
    update(step: number, width: number, height: number): void {
        for (let index = this.thrown.length - 1; index >= 0; index--) {
            const snow = this.thrown[index];
            snow.vy += 0.25 * step;
            snow.vx *= 0.99 ** step;
            snow.x += snow.vx * step;
            snow.y += snow.vy * step;

            if (snow.x < -10 || snow.x > width + 10) {
                this.thrown.splice(index, 1);
            } else if (snow.vy > 0 && snow.y >= height - this.depthAt(snow.x)) {
                // Shovelled snow packs together, so only part of it adds to the drift where it lands.
                const column = this.column(snow.x);
                this.add(column, snow.amount * 0.2);
                this.add(column - 1, snow.amount * 0.1);
                this.add(column + 1, snow.amount * 0.1);
                this.thrown.splice(index, 1);
            }
        }

        // Snow only slides where it is steeper than about 30°, so shovelled paths stay open.
        for (let pass = 0; pass < 2; pass++) {
            const forward = pass % 2 === 0;
            for (let index = 0; index < this.depths.length - 1; index++) {
                const column = forward ? index : this.depths.length - 2 - index;
                const difference =
                    this.depths[column] - this.depths[column + 1];
                if (Math.abs(difference) > MAX_SLOPE) {
                    const moved = (Math.abs(difference) - MAX_SLOPE) / 2;
                    const from = difference > 0 ? column : column + 1;
                    const to = difference > 0 ? column + 1 : column;
                    this.depths[from] -= moved;
                    this.depths[to] += moved;
                }
            }
        }
    }

    draw(
        context: CanvasRenderingContext2D,
        width: number,
        height: number,
        isDark: boolean,
    ): void {
        if (this.depths.length === 0) {
            return;
        }
        const fill = isDark ? 'rgba(241, 245, 249, 0.96)' : '#ffffff';

        context.beginPath();
        context.moveTo(0, height);
        this.traceSurface(context, height);
        context.lineTo(width, height);
        context.closePath();

        const shade = context.createLinearGradient(
            0,
            height - MAX_DEPTH,
            0,
            height,
        );
        shade.addColorStop(0, fill);
        shade.addColorStop(1, isDark ? 'rgba(203, 213, 225, 0.96)' : '#d5dee8');
        context.fillStyle = shade;
        context.fill();

        if (!isDark) {
            // A faint edge, so white snow shows against a light page.
            context.strokeStyle = 'rgba(100, 116, 139, 0.55)';
            context.lineWidth = 1.5;
            context.beginPath();
            context.moveTo(0, height - this.depths[0]);
            this.traceSurface(context, height);
            context.stroke();
        }

        context.fillStyle = fill;
        for (const snow of this.thrown) {
            const size = 2 + Math.min(snow.amount, 4);
            context.fillRect(snow.x - size / 2, snow.y - size / 2, size, size);
        }
    }

    /** The drift's surface as a smooth curve through the column tops. */
    private traceSurface(
        context: CanvasRenderingContext2D,
        height: number,
    ): void {
        const y = (column: number) => height - this.depths[column];
        context.lineTo(0, y(0));
        for (let column = 1; column < this.depths.length; column++) {
            const midX = (column - 0.5) * COLUMN_WIDTH;
            const midY = (y(column - 1) + y(column)) / 2;
            context.quadraticCurveTo(
                (column - 1) * COLUMN_WIDTH,
                y(column - 1),
                midX,
                midY,
            );
        }
        context.lineTo(
            (this.depths.length - 1) * COLUMN_WIDTH,
            y(this.depths.length - 1),
        );
    }

    private column(x: number): number {
        return Math.max(
            0,
            Math.min(this.depths.length - 1, Math.round(x / COLUMN_WIDTH)),
        );
    }

    private add(column: number, amount: number): void {
        if (column < 0 || column >= this.depths.length) {
            return;
        }
        this.depths[column] = Math.min(MAX_DEPTH, this.depths[column] + amount);
    }
}
