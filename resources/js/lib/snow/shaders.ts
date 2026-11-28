import { SNOWMAN_RADII } from './geometry';

/**
 * WGSL for the WebGPU renderer. Everything is drawn in one pass with premultiplied alpha: the snowman,
 * the drift in front of its foot, then flakes and thrown snow as instanced quads. Positions are CSS
 * pixels; `ratio` is the device pixel ratio, used to keep edges one device pixel soft.
 */
const COMMON = /* wgsl */ `
struct Globals {
    size: vec2f,
    ratio: f32,
    time: f32,
    dark: f32,
    columns: f32,
    columnWidth: f32,
    maxDepth: f32,
    // x position and how far each of the three balls has grown
    snowman: vec4f,
    // accessories (0-1), build outline (0-1), lean, waving (0-1)
    dress: vec4f,
    // wind direction (-1 to 1)
    weather: vec4f,
};

@group(0) @binding(0) var<uniform> globals: Globals;

fn toClip(point: vec2f) -> vec4f {
    return vec4f(
        point.x / globals.size.x * 2.0 - 1.0,
        1.0 - point.y / globals.size.y * 2.0,
        0.0,
        1.0,
    );
}

fn corner(index: u32) -> vec2f {
    var corners = array<vec2f, 6>(
        vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
        vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
    );
    return corners[index];
}

fn hash21(point: vec2f) -> f32 {
    var p = fract(vec3f(point.xyx) * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}

fn hash22(point: vec2f) -> vec2f {
    var p = fract(vec3f(point.xyx) * vec3f(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yzx + 33.33);
    return fract((p.xx + p.yz) * p.zy);
}

// Ice crystals that catch the light for a moment, each at its own pace.
fn sparkle(point: vec2f) -> f32 {
    let cell = floor(point / 5.0);
    let random = hash22(cell);
    let centre = (cell + 0.2 + 0.6 * random) * 5.0;
    let twinkle = pow(
        max(0.0, sin(random.x * 40.0 + globals.time * (0.7 + random.y * 1.8))),
        22.0,
    );
    return twinkle
        * smoothstep(1.4, 0.0, length(point - centre))
        * step(0.7, hash21(cell + 7.3));
}

fn premultiplied(color: vec3f, alpha: f32) -> vec4f {
    return vec4f(color * alpha, alpha);
}
`;

export const PARTICLE_SHADER = /* wgsl */ `
${COMMON}

struct ParticleOut {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
    // alpha, kind, extra, radius in device pixels
    @location(1) @interpolate(flat) look: vec4f,
    @location(2) @interpolate(flat) facing: f32,
};

@vertex
fn vertex(
    @builtin(vertex_index) index: u32,
    // x, y, radius, alpha
    @location(0) place: vec4f,
    // rotation, tumble (1 faces the viewer), kind, extra
    @location(1) shape: vec4f,
) -> ParticleOut {
    let uv = corner(index) * 2.0 - 1.0;
    let local = uv * vec2f(place.z * shape.y, place.z);
    let c = cos(shape.x);
    let s = sin(shape.x);
    var out: ParticleOut;
    out.position = toClip(
        place.xy + vec2f(local.x * c - local.y * s, local.x * s + local.y * c),
    );
    out.uv = uv;
    out.look = vec4f(place.w, shape.z, shape.w, place.z * globals.ratio);
    out.facing = shape.y;
    return out;
}

fn segment(point: vec2f, start: vec2f, end: vec2f) -> f32 {
    let along = clamp(
        dot(point - start, end - start) / dot(end - start, end - start),
        0.0,
        1.0,
    );
    return length(point - start - (end - start) * along);
}

// A six-armed snow crystal: one arm with two pairs of side branches, mirrored six ways.
fn crystal(uv: vec2f, variety: f32) -> f32 {
    let sector = 1.0471976;
    let radius = length(uv);
    let angle = abs(fract(atan2(uv.y, uv.x) / sector + 0.5) - 0.5) * sector;
    let point = radius * vec2f(cos(angle), sin(angle));
    let inner = 0.36 + 0.1 * fract(variety * 3.7);
    let outer = 0.62 + 0.08 * fract(variety * 7.3);
    let lean = vec2f(0.5, 0.866);
    var distance = segment(point, vec2f(0.0), vec2f(0.9, 0.0));
    distance = min(
        distance,
        segment(point, vec2f(inner, 0.0), vec2f(inner, 0.0) + lean * 0.3),
    );
    distance = min(
        distance,
        segment(point, vec2f(outer, 0.0), vec2f(outer, 0.0) + lean * 0.18),
    );
    return min(distance - 0.045, radius - 0.2);
}

@fragment
fn fragment(in: ParticleOut) -> @location(0) vec4f {
    let radius = length(in.uv);
    let kind = in.look.y;
    let pixel = 1.0 / max(in.look.w, 1.0);
    let dark = globals.dark;
    // White snow on dark pages; against a light page falling snow reads as cool grey, like flakes
    // against a bright sky.
    var color = mix(vec3f(0.37, 0.44, 0.54), vec3f(1.0), dark);
    var alpha = 0.0;

    if (kind < 0.5) {
        if (in.look.z > 0.5) {
            // Close to the lens and out of focus: a soft disc with a slightly brighter rim.
            alpha = (1.0 - smoothstep(0.6, 0.98, radius))
                * (0.7 + 0.3 * smoothstep(0.25, 0.7, radius));
        } else {
            alpha = exp(-radius * radius * 4.2) * (1.0 - smoothstep(0.8, 1.0, radius));
        }
        alpha *= mix(0.8, 1.0, dark);
    } else if (kind < 1.5) {
        let shape = 1.0 - smoothstep(-pixel, pixel * 1.5, crystal(in.uv, in.look.z));
        let glow = exp(-radius * radius * 3.4) * 0.42;
        // Brightest when the flat side turns towards the viewer.
        alpha = max(shape, glow) * (0.72 + 0.4 * in.facing) * mix(0.85, 1.0, dark);
    } else if (kind < 2.5) {
        // Thrown snow: small lit lumps.
        let light = clamp(0.6 - in.uv.y * 0.5 - in.uv.x * 0.3, 0.0, 1.0);
        color = mix(vec3f(0.72, 0.8, 0.91), vec3f(1.0), light);
        color = mix(color, vec3f(0.6, 0.68, 0.8), (1.0 - dark) * smoothstep(0.5, 1.0, radius) * 0.45);
        alpha = 1.0 - smoothstep(0.45, 1.0, radius);
    } else if (kind < 3.5) {
        // Powder hanging in the air.
        color = mix(vec3f(0.7, 0.76, 0.85), vec3f(1.0), dark);
        alpha = exp(-radius * radius * 3.0) * (1.0 - smoothstep(0.75, 1.0, radius)) * mix(0.7, 1.0, dark);
    } else {
        // A glint: a four-pointed star.
        color = mix(vec3f(0.98, 0.72, 0.2), vec3f(1.0, 0.93, 0.7), dark);
        let star = max(0.0, 1.0 - abs(in.uv.x * in.uv.y) * 26.0 - radius * 0.9);
        alpha = max(star, exp(-radius * radius * 16.0));
    }

    return premultiplied(color, alpha * in.look.x);
}
`;

export const DRIFT_SHADER = /* wgsl */ `
${COMMON}

@group(0) @binding(1) var depths: texture_2d<f32>;

struct DriftOut {
    @builtin(position) position: vec4f,
    @location(0) point: vec2f,
};

@vertex
fn vertex(@builtin(vertex_index) index: u32) -> DriftOut {
    let uv = corner(index);
    let top = globals.size.y - globals.maxDepth - 8.0;
    let point = vec2f(uv.x * globals.size.x, mix(top, globals.size.y, uv.y));
    var out: DriftOut;
    out.position = toClip(point);
    out.point = point;
    return out;
}

fn depthOf(column: i32) -> f32 {
    return textureLoad(
        depths,
        vec2i(clamp(column, 0, i32(globals.columns) - 1), 0),
        0,
    ).r;
}

@fragment
fn fragment(in: DriftOut) -> @location(0) vec4f {
    // A cubic B-spline through the columns gives a smooth surface and a smooth slope.
    let position = in.point.x / globals.columnWidth;
    let column = i32(floor(position));
    let t = fract(position);
    let t2 = t * t;
    let t3 = t2 * t;
    let a = depthOf(column - 1);
    let b = depthOf(column);
    let c = depthOf(column + 1);
    let d = depthOf(column + 2);
    let depth = (a * (1.0 - 3.0 * t + 3.0 * t2 - t3)
        + b * (3.0 * t3 - 6.0 * t2 + 4.0)
        + c * (-3.0 * t3 + 3.0 * t2 + 3.0 * t + 1.0)
        + d * t3) / 6.0;
    let slope = (-a * (1.0 - t) * (1.0 - t)
        + b * (3.0 * t2 - 4.0 * t)
        + c * (-3.0 * t2 + 2.0 * t + 1.0)
        + d * t2) / (2.0 * globals.columnWidth);

    // Distance below the surface, measured across the slope.
    let inside = (depth - (globals.size.y - in.point.y)) / sqrt(1.0 + slope * slope);
    let coverage = clamp(inside * globals.ratio + 0.5, 0.0, 1.0) * smoothstep(0.0, 1.5, depth);
    if (coverage <= 0.0) {
        discard;
    }

    let dark = globals.dark;
    // The light comes from the upper left: sides that rise to the right face it.
    // Single flakes leave the surface slightly rough; the light follows the broader shape.
    let broad = (depthOf(column + 4) - depthOf(column - 3)) / (7.0 * globals.columnWidth);
    let lit = clamp(0.56 + mix(slope, broad, 0.75) * 0.9, 0.0, 1.0);
    let deepness = clamp(inside / 24.0, 0.0, 1.0);
    let shade = mix(vec3f(0.75, 0.82, 0.92), vec3f(0.66, 0.76, 0.92), dark);
    let bright = mix(vec3f(0.95, 0.97, 1.0), vec3f(1.0), dark);
    let deep = mix(vec3f(0.77, 0.84, 0.93), vec3f(0.58, 0.69, 0.87), dark);
    var color = mix(mix(shade, bright, lit), deep, deepness * 0.9);

    // Powder along the crest catches the light.
    color += vec3f(0.07) * (1.0 - smoothstep(0.0, 3.5, inside)) * lit;
    color += (hash21(floor(in.point * globals.ratio)) - 0.5) * 0.028;
    color += sparkle(in.point) * (1.0 - deepness * 0.6) * (0.35 + 0.65 * lit);

    // The snowman's shadow falls to the right of it.
    let across = (in.point.x - globals.snowman.x - 16.0 * globals.snowman.y) / 30.0;
    let shadow = globals.snowman.y * exp(-across * across) * 0.2;
    color *= vec3f(1.0) - shadow * vec3f(1.0, 0.8, 0.5);

    // On a light page the snow needs an edge to stand out from the background.
    let edge = (1.0 - smoothstep(0.0, 1.5, inside)) * (1.0 - dark);
    color = mix(color, vec3f(0.47, 0.55, 0.68), edge * 0.6);

    return premultiplied(clamp(color, vec3f(0.0), vec3f(1.0)), coverage);
}
`;

export const SNOWMAN_SHADER = /* wgsl */ `
${COMMON}

const RADII = vec3f(${SNOWMAN_RADII.map((radius) => radius.toFixed(1)).join(', ')});
const LIGHT = vec3f(-0.51, 0.63, 0.59);
const COAL = vec3f(0.09, 0.09, 0.11);

struct SnowmanOut {
    @builtin(position) position: vec4f,
    // x from the middle of the snowman, y up from the ground
    @location(0) point: vec2f,
};

@vertex
fn vertex(@builtin(vertex_index) index: u32) -> SnowmanOut {
    let uv = corner(index);
    let point = vec2f(mix(-84.0, 84.0, uv.x), mix(-4.0, 150.0, uv.y));
    var out: SnowmanOut;
    out.position = toClip(vec2f(globals.snowman.x + point.x, globals.size.y - point.y));
    out.point = point;
    return out;
}

fn over(below: vec4f, above: vec4f) -> vec4f {
    return above + below * (1.0 - above.a);
}

// Coverage of a shape from its signed distance in CSS pixels.
fn cover(distance: f32) -> f32 {
    return clamp(0.5 - distance * globals.ratio, 0.0, 1.0);
}

fn segment(point: vec2f, start: vec2f, end: vec2f) -> f32 {
    let along = clamp(
        dot(point - start, end - start) / max(dot(end - start, end - start), 0.0001),
        0.0,
        1.0,
    );
    return length(point - start - (end - start) * along);
}

fn box(point: vec2f, half: vec2f) -> f32 {
    let q = abs(point) - half;
    return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0);
}

fn turn(point: vec2f, angle: f32) -> vec2f {
    let c = cos(angle);
    let s = sin(angle);
    return vec2f(point.x * c - point.y * s, point.x * s + point.y * c);
}

// Scale from 0 to 1 with a little overshoot while "amount" passes from "start" to "end".
fn pop(amount: f32, start: f32, end: f32) -> f32 {
    let t = clamp((amount - start) / (end - start), 0.0, 1.0) - 1.0;
    return 1.0 + 2.70158 * t * t * t + 1.70158 * t * t;
}

// A ball of packed snow, lit as a sphere and not quite round.
fn snowBall(point: vec2f, centre: vec2f, radius: f32, seed: f32) -> vec4f {
    if (radius < 0.75) {
        return vec4f(0.0);
    }
    let offset = point - centre;
    let angle = atan2(offset.y, offset.x);
    let lumpy = radius * (1.0 + 0.022 * sin(angle * 5.0 + seed) + 0.016 * sin(angle * 9.0 + seed * 2.3));
    let distance = length(offset) - lumpy;
    let plane = offset / lumpy;
    let normal = vec3f(plane, sqrt(max(0.0, 1.0 - dot(plane, plane))));
    let diffuse = max(dot(normal, LIGHT), 0.0) * 0.8 + 0.2;
    let shade = mix(vec3f(0.66, 0.75, 0.89), vec3f(0.5, 0.61, 0.83), globals.dark);
    var color = mix(shade, vec3f(1.0), smoothstep(0.12, 0.88, diffuse));
    color = mix(color, shade, pow(1.0 - normal.z, 3.0) * 0.5);
    // Light bounced up from the snow on the ground.
    color += vec3f(0.04, 0.05, 0.07) * max(-normal.y, 0.0);
    color += (hash21(floor(point * globals.ratio)) - 0.5) * 0.03;
    color += sparkle(point + vec2f(seed * 13.0, 0.0)) * diffuse * 0.7;
    let edge = (1.0 - smoothstep(0.0, 1.6, -distance)) * (1.0 - globals.dark);
    color = mix(color, vec3f(0.45, 0.53, 0.66), edge * 0.6);
    return premultiplied(clamp(color, vec3f(0.0), vec3f(1.0)), cover(distance));
}

fn coalDot(point: vec2f, centre: vec2f, radius: f32) -> vec4f {
    let offset = point - centre;
    let shine = smoothstep(radius * 0.55, 0.0, length(offset - vec2f(-0.35, 0.4) * radius));
    return premultiplied(COAL + vec3f(0.3) * shine, cover(length(offset) - radius));
}

// A stick arm from the shoulder to the hand, with two twigs as fingers.
fn arm(point: vec2f, shoulder: vec2f, hand: vec2f, grown: f32) -> vec4f {
    if (grown <= 0.01) {
        return vec4f(0.0);
    }
    let tip = shoulder + (hand - shoulder) * grown;
    let along = normalize(hand - shoulder);
    let fork = shoulder + (tip - shoulder) * 0.68;
    var distance = segment(point, shoulder, tip) - 1.15;
    distance = min(distance, segment(point, fork, fork + turn(along, 0.75) * 7.0 * grown) - 0.85);
    distance = min(distance, segment(point, fork, fork + turn(along, -0.65) * 5.5 * grown) - 0.85);
    let color = mix(vec3f(0.33, 0.22, 0.14), vec3f(0.46, 0.32, 0.2), globals.dark);
    return premultiplied(color, cover(distance));
}

@fragment
fn fragment(in: SnowmanOut) -> @location(0) vec4f {
    var point = in.point;
    // It leans from the foot, more the higher up.
    point.x -= globals.dress.z * point.y * point.y * 0.00045;

    let growth = globals.snowman.yzw;
    let radius = RADII * growth;
    let low = vec2f(0.0, radius.x * 0.86);
    let middle = vec2f(0.0, low.y + radius.x * 0.74 + radius.y * 0.7);
    let head = vec2f(0.0, middle.y + radius.y * 0.74 + radius.z * 0.72);
    // Where the balls end up when the snowman is finished.
    let fullLow = vec2f(0.0, RADII.x * 0.86);
    let fullMiddle = vec2f(0.0, fullLow.y + RADII.x * 0.74 + RADII.y * 0.7);
    let fullHead = vec2f(0.0, fullMiddle.y + RADII.y * 0.74 + RADII.z * 0.72);
    let dressed = globals.dress.x;
    var result = vec4f(0.0);

    // A dashed outline shows where to throw the snow.
    let outline = globals.dress.y;
    if (outline > 0.01) {
        let rings = min(
            min(abs(length(in.point - fullLow) - RADII.x), abs(length(in.point - fullMiddle) - RADII.y)),
            abs(length(in.point - fullHead) - RADII.z),
        );
        let hidden = min(
            min(length(in.point - fullLow) - RADII.x, length(in.point - fullMiddle) - RADII.y),
            length(in.point - fullHead) - RADII.z,
        );
        let dash = step(0.5, fract((in.point.x + in.point.y) * 0.11 - globals.time * 0.35));
        let pulse = 0.55 + 0.25 * sin(globals.time * 2.4);
        let line = cover(rings - 0.8) * dash * step(-1.0, hidden) * outline * pulse;
        result = premultiplied(mix(vec3f(0.35, 0.43, 0.56), vec3f(1.0), globals.dark), line);
    }

    // The arms go in first, so the body covers where they are stuck in.
    let reach = pop(dressed, 0.5, 0.75);
    let wave = globals.dress.w * sin(globals.time * 7.0) * 0.32;
    result = over(result, arm(
        point,
        fullMiddle + vec2f(-RADII.y * 0.7, 3.0),
        fullMiddle + vec2f(-RADII.y - 19.0, 15.0),
        reach,
    ));
    result = over(result, arm(
        point,
        fullMiddle + vec2f(RADII.y * 0.7, 3.0),
        fullMiddle + vec2f(RADII.y * 0.7, 3.0) + turn(vec2f(19.0, 13.0 + 9.0 * globals.dress.w), wave),
        reach,
    ));

    result = over(result, snowBall(point, low, radius.x, 1.0));
    var body = snowBall(point, middle, radius.y, 2.7);
    // Each ball shades the one below it.
    result = vec4f(
        result.rgb * (1.0 - 0.3 * growth.y * smoothstep(radius.y * 1.35, radius.y * 0.75, length(point - middle + vec2f(-2.0, radius.y * 0.2)))),
        result.a,
    );
    result = over(result, body);
    result = vec4f(
        result.rgb * (1.0 - 0.28 * growth.z * smoothstep(radius.z * 1.4, radius.z * 0.75, length(point - head + vec2f(-1.5, radius.z * 0.25)))),
        result.a,
    );
    result = over(result, snowBall(point, head, radius.z, 4.1));

    if (dressed > 0.0) {
        // Coal buttons.
        let buttons = pop(dressed, 0.4, 0.6);
        result = over(result, coalDot(point, fullMiddle + vec2f(-1.0, 8.0), 1.6 * buttons));
        result = over(result, coalDot(point, fullMiddle + vec2f(-1.4, 1.0), 1.7 * buttons));
        result = over(result, coalDot(point, fullMiddle + vec2f(-1.0, -6.0), 1.6 * buttons));

        // The scarf round the neck, with a tail that flutters in the wind.
        let tied = pop(dressed, 0.65, 0.85);
        let neck = vec2f(0.0, fullMiddle.y + RADII.y * 0.8);
        var around = point - neck;
        around.y += around.x * around.x * 0.014;
        let halfWidth = RADII.z * 0.95 * tied;
        let flutter = (globals.weather.x * 3.5 + sin(globals.time * 3.3 + point.y * 0.25) * 1.3) * clamp((neck.y - point.y) / 14.0, 0.0, 1.0);
        let tail = segment(
            point - vec2f(flutter, 0.0),
            neck + vec2f(RADII.z * 0.45, -2.0),
            neck + vec2f(RADII.z * 0.55, -2.0 - 15.0 * tied),
        ) - 2.9 * tied;
        let scarf = min(box(around, vec2f(halfWidth, 3.1 * tied)) - 0.6, tail);
        let stripes = step(0.5, fract((point.x - flutter + point.y) * 0.17));
        var wool = mix(vec3f(0.78, 0.14, 0.18), vec3f(0.92, 0.3, 0.3), stripes * 0.55);
        wool *= 1.0 - 0.3 * pow(clamp(abs(around.x) / max(halfWidth, 0.01), 0.0, 1.0), 2.0);
        result = over(result, premultiplied(wool, cover(scarf) * step(0.01, tied)));

        // The face looks a little to the left, towards the middle of the page.
        let face = fullHead + vec2f(-2.0, 0.0);
        let eyes = pop(dressed, 0.0, 0.2);
        let blink = 1.0 - 0.85 * step(0.965, fract(globals.time * 0.21));
        let leftEye = (point - face - vec2f(-4.4, 2.8)) / vec2f(1.0, blink);
        let rightEye = (point - face - vec2f(4.2, 2.8)) / vec2f(1.0, blink);
        result = over(result, coalDot(leftEye, vec2f(0.0), 1.7 * eyes));
        result = over(result, coalDot(rightEye, vec2f(0.0), 1.7 * eyes));

        let smile = pop(dressed, 0.3, 0.5);
        for (var piece = -2; piece <= 2; piece++) {
            let place = f32(piece);
            result = over(result, coalDot(
                point,
                face + vec2f(place * 2.5, -6.3 + place * place * 0.6),
                0.95 * smile,
            ));
        }

        // The carrot nose points down to the left, thick at the face and thin at the tip.
        let grown = pop(dressed, 0.15, 0.4);
        let root = face + vec2f(-0.5, -0.9);
        let tip = root + vec2f(-13.5, -2.6) * grown;
        let along = clamp(dot(point - root, tip - root) / max(dot(tip - root, tip - root), 0.0001), 0.0, 1.0);
        let carrot = length(point - root - (tip - root) * along) - mix(2.5, 0.35, along) * grown;
        var orange = mix(vec3f(0.98, 0.56, 0.14), vec3f(0.84, 0.36, 0.06), smoothstep(-1.0, 1.6, root.y - point.y + along * -2.6));
        orange *= 1.0 - 0.14 * step(0.6, fract(along * 5.0));
        result = over(result, premultiplied(orange, cover(carrot) * step(0.01, grown)));

        // The top hat comes last, a little askew, with fresh snow on top.
        let fitted = pop(dressed, 0.8, 1.0);
        if (fitted > 0.01) {
            let brow = fullHead + vec2f(1.2, RADII.z * 0.7);
            let hat = turn(point - brow, 0.15) / fitted;
            let brim = box(hat, vec2f(RADII.z * 1.02, 1.3)) - 0.8;
            let crown = box(hat - vec2f(0.0, 8.6), vec2f(RADII.z * 0.66, 8.0)) - 1.0;
            var felt = mix(vec3f(0.1, 0.11, 0.14), vec3f(0.27, 0.29, 0.34), clamp(0.5 - hat.x / (RADII.z * 1.5), 0.0, 1.0));
            felt = mix(felt, vec3f(0.78, 0.14, 0.18), step(abs(hat.y - 3.9), 1.7) * step(hat.y, 9.0) * step(1.6, hat.y));
            let outlineDark = globals.dark * (1.0 - smoothstep(0.0, 1.2, -min(brim, crown))) * 0.35;
            felt += vec3f(outlineDark);
            result = over(result, premultiplied(felt, cover(min(brim, crown) * fitted)));
            let cap = (length((hat - vec2f(0.0, 17.2)) / vec2f(RADII.z * 0.68, 2.6)) - 1.0) * 2.6;
            result = over(result, premultiplied(mix(vec3f(0.86, 0.91, 0.98), vec3f(1.0), clamp(0.5 - hat.x * 0.08, 0.0, 1.0)), cover(cap * fitted)));
        }
    }

    return result;
}
`;
