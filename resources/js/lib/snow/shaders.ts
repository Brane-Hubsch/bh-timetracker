import { SNOWMAN_RADII } from './geometry';
import { MODEL_MAX_PARTS } from './models';

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

// Ice crystals that catch the light for a moment, each at its own pace: small four-pointed stars.
fn sparkle(point: vec2f) -> f32 {
    let cell = floor(point / 6.0);
    let random = hash22(cell);
    let offset = point - (cell + 0.25 + 0.5 * random) * 6.0;
    let twinkle = pow(
        max(0.0, sin(random.x * 40.0 + globals.time * (0.7 + random.y * 1.8))),
        18.0,
    );
    let star = max(0.0, 1.0 - abs(offset.x * offset.y) * 3.0 - length(offset) * 0.42);
    return twinkle * star * step(0.72, hash21(cell + 7.3));
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
        // Thrown snow: small tumbling chunks, cut like the rest, with a lit and a shaded face.
        let chunk = abs(in.uv.x) * 0.85 + abs(in.uv.y) * 1.15;
        let lit = step(0.0, in.uv.x * 0.6 - in.uv.y);
        color = mix(mix(vec3f(0.69, 0.77, 0.9), vec3f(0.64, 0.74, 0.93), dark), vec3f(1.0), lit);
        color = mix(color, vec3f(0.56, 0.64, 0.78), (1.0 - dark) * (1.0 - lit) * 0.35);
        alpha = 1.0 - smoothstep(0.92 - pixel * 1.5, 0.92, chunk);
    } else if (kind < 3.5) {
        // Powder hanging in the air.
        color = mix(vec3f(0.7, 0.76, 0.85), vec3f(1.0), dark);
        alpha = exp(-radius * radius * 3.0) * (1.0 - smoothstep(0.75, 1.0, radius)) * mix(0.7, 1.0, dark);
    } else if (kind > 4.5) {
        // Powder in the snowblower's jet: a soft streak along its path.
        color = mix(vec3f(0.66, 0.73, 0.83), vec3f(1.0), dark);
        alpha = exp(-radius * radius * 2.6) * (1.0 - smoothstep(0.7, 1.0, radius)) * mix(0.85, 1.0, dark);
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

// The drift is cut into facets: its surface is a row of straight edges between knots a few columns
// apart, and the snow below is three rows of triangles.
const KNOT = 7.0;

// The surface at a knot, evened out over the columns around it.
fn knot(index: i32) -> f32 {
    let column = index * i32(KNOT);
    return (depthOf(column - 2) + depthOf(column) * 2.0 + depthOf(column + 2)) * 0.25;
}

// A point inside the snow under the middle of the edge that starts at a knot.
fn inner(index: i32) -> f32 {
    let depth = (knot(index) + knot(index + 1)) * 0.5;
    return depth * (0.42 + 0.2 * hash21(vec2f(f32(index), 3.7)));
}

@fragment
fn fragment(in: DriftOut) -> @location(0) vec4f {
    let width = KNOT * globals.columnWidth;
    let position = in.point.x / width;
    let cell = i32(floor(position));
    let t = fract(position);
    let height = globals.size.y - in.point.y;
    let left = knot(cell);
    let right = knot(cell + 1);
    let depth = mix(left, right, t);
    let slope = (right - left) / width;
    let inside = (depth - height) / sqrt(1.0 + slope * slope);
    let coverage = clamp(inside * globals.ratio + 0.5, 0.0, 1.0) * smoothstep(0.0, 1.5, depth);
    if (coverage <= 0.0) {
        discard;
    }

    // Which triangle is this? "facet" identifies it, "tilt" is how it leans and "row" how deep it is.
    let middle = inner(cell);
    let valley = mix(mix(left, middle, t * 2.0), mix(middle, right, t * 2.0 - 1.0), step(0.5, t));
    var facet = vec2f(f32(cell), 0.0);
    var tilt = slope;
    var row = 0.0;
    if (height < valley) {
        // Under the surface triangles: one that stands on the row of inner points, or one below it.
        let near = cell + i32(step(0.5, t));
        let offset = t - step(0.5, t);
        let before = inner(near - 1);
        let after = inner(near);
        let ridge = mix(before, after, offset + 0.5);
        if (height > ridge) {
            facet = vec2f(f32(near), 1.0);
            tilt = (after - before) / width;
            row = 1.0;
        } else {
            let wedge = mix(before, after, step(0.0, offset)) * abs(offset) * 2.0;
            let pointed = step(wedge, height);
            facet = vec2f(mix(f32(cell), f32(near), pointed), 2.0 + pointed);
            tilt = (after - before) / width * (1.0 - pointed);
            row = 2.0;
        }
    }

    let dark = globals.dark;
    // The light comes from the upper left: faces that rise to the right turn towards it.
    let lit = clamp(0.58 + tilt * 1.1 + (hash21(facet) - 0.5) * 0.3 - row * 0.13, 0.0, 1.0);
    let shade = mix(vec3f(0.72, 0.8, 0.93), vec3f(0.55, 0.66, 0.9), dark);
    let bright = mix(vec3f(0.97, 0.98, 1.0), vec3f(1.0), dark);
    var color = mix(shade, bright, lit);
    color += sparkle(in.point) * (1.0 - row * 0.3) * (0.35 + 0.65 * lit);

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

export const OUTLINE_SHADER = /* wgsl */ `
${COMMON}

const RADII = vec3f(${SNOWMAN_RADII.map((radius) => radius.toFixed(1)).join(', ')});

struct OutlineOut {
    @builtin(position) position: vec4f,
    // x from the middle of the snowman, y up from the ground
    @location(0) point: vec2f,
};

@vertex
fn vertex(@builtin(vertex_index) index: u32) -> OutlineOut {
    let uv = corner(index);
    let point = vec2f(mix(-40.0, 40.0, uv.x), mix(-4.0, 110.0, uv.y));
    var out: OutlineOut;
    out.position = toClip(vec2f(globals.snowman.x + point.x, globals.size.y - point.y));
    out.point = point;
    return out;
}

// A dashed outline of the finished snowman shows where to throw the snow.
@fragment
fn fragment(in: OutlineOut) -> @location(0) vec4f {
    let low = vec2f(0.0, RADII.x * 0.86);
    let middle = vec2f(0.0, low.y + RADII.x * 0.74 + RADII.y * 0.7);
    let head = vec2f(0.0, middle.y + RADII.y * 0.74 + RADII.z * 0.72);
    let inside = min(
        min(length(in.point - low) - RADII.x, length(in.point - middle) - RADII.y),
        length(in.point - head) - RADII.z,
    );
    let dash = step(0.5, fract((in.point.x + in.point.y) * 0.11 - globals.time * 0.35));
    let pulse = 0.6 + 0.25 * sin(globals.time * 2.4);
    let line = clamp(0.5 - (abs(inside) - 1.0) * globals.ratio, 0.0, 1.0);
    let color = mix(vec3f(0.42, 0.5, 0.66), vec3f(1.0), globals.dark);
    return premultiplied(color, line * dash * pulse * globals.dress.y);
}
`;

/**
 * The snowman and the tools are small models, each drawn into a multisampled texture of its own (so the
 * edges are smooth without multisampling the whole page) and then placed on the page as a sprite.
 * They are low-poly: every face is flat and gets one tone, from lavender shade to full light.
 */
export const MODEL_SHADER = /* wgsl */ `
struct Model {
    // one matrix per part: stored position to CSS pixels around the middle of the sprite
    parts: array<mat4x4f, ${MODEL_MAX_PARTS}>,
    // half the sprite's side, depth range, dark theme (0 or 1), time
    look: vec4f,
};

@group(0) @binding(0) var<uniform> model: Model;

struct ModelOut {
    @builtin(position) position: vec4f,
    @location(0) normal: vec3f,
    // colour, and the material in alpha: 1 matte, 0.5 glossy, 0 snow
    @location(1) color: vec4f,
    @location(2) point: vec3f,
};

@vertex
fn vertex(
    // position as a fraction of the model's extent, and the part index
    @location(0) place: vec4f,
    @location(1) normal: vec4f,
    @location(2) color: vec4f,
) -> ModelOut {
    let part = model.parts[u32(round(place.w * 32767.0))];
    let point = part * vec4f(place.xyz, 1.0);
    var out: ModelOut;
    out.position = vec4f(
        point.xy / model.look.x,
        0.5 - point.z / model.look.y,
        1.0,
    );
    out.normal = (part * vec4f(normal.xyz, 0.0)).xyz;
    out.color = color;
    out.point = point.xyz;
    return out;
}

fn hash21(point: vec2f) -> f32 {
    var p = fract(vec3f(point.xyx) * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}

@fragment
fn fragment(in: ModelOut) -> @location(0) vec4f {
    // Every face is flat: one normal, one tone.
    var normal = normalize(in.normal);
    if (normal.z < 0.0) {
        normal = -normal;
    }
    let dark = model.look.z;
    let snow = 1.0 - step(0.25, in.color.a);
    let glossy = step(0.25, in.color.a) * (1.0 - step(0.75, in.color.a));
    let light = vec3f(-0.51, 0.63, 0.59);
    let facing = dot(normal, light);

    // From tinted shade to full light, so neighbouring faces differ; the shade is never grey.
    let lit = smoothstep(-0.45, 0.95, facing);
    let shade = mix(
        mix(vec3f(0.6, 0.55, 0.76), vec3f(0.5, 0.49, 0.75), dark),
        mix(vec3f(0.7, 0.79, 0.96), vec3f(0.56, 0.67, 0.93), dark),
        snow,
    );
    var color = in.color.rgb * mix(shade, vec3f(1.04, 1.03, 1.0), lit);
    // Faces that look up catch the sky; faces that look down, the snow.
    color += vec3f(0.05, 0.06, 0.08) * max(normal.y, 0.0);
    color += vec3f(0.05, 0.07, 0.12) * max(-normal.y, 0.0) * (1.0 - snow);
    // Painted plastic and eyes glint on the faces turned to the light.
    color += vec3f(0.22) * pow(max(dot(normal, normalize(light + vec3f(0.0, 0.0, 1.0))), 0.0), 12.0) * glossy;
    // No two faces of hand-packed snow are quite the same white.
    color *= 1.0 + (hash21(normal.xy * 91.7 + normal.z * 13.3) - 0.5) * 0.05 * snow;

    return vec4f(clamp(color, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;

export const SPRITE_SHADER = /* wgsl */ `
${COMMON}

struct Sprite {
    // middle on the page and half the side in CSS pixels, and one texel of the image
    rect: vec4f,
};

@group(0) @binding(1) var<uniform> sprite: Sprite;
@group(0) @binding(2) var image: texture_2d<f32>;
@group(0) @binding(3) var filtering: sampler;

struct SpriteOut {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
};

@vertex
fn vertex(@builtin(vertex_index) index: u32) -> SpriteOut {
    let uv = corner(index);
    var out: SpriteOut;
    out.position = toClip(sprite.rect.xy + (uv * 2.0 - 1.0) * sprite.rect.z);
    out.uv = uv;
    return out;
}

// The model with a thin dark edge, so pale faces stand out from a pale page, and a faint shadow.
@fragment
fn fragment(in: SpriteOut) -> @location(0) vec4f {
    let texel = sprite.rect.w * globals.ratio;
    var around = array<vec2f, 8>(
        vec2f(1.0, 0.0), vec2f(-1.0, 0.0), vec2f(0.0, 1.0), vec2f(0.0, -1.0),
        vec2f(0.7, 0.7), vec2f(-0.7, 0.7), vec2f(0.7, -0.7), vec2f(-0.7, -0.7),
    );
    var outline = 0.0;
    var shadow = 0.0;
    for (var tap = 0; tap < 8; tap++) {
        outline = max(outline, textureSampleLevel(image, filtering, in.uv + around[tap] * texel * 0.9, 0.0).a);
        shadow += textureSampleLevel(image, filtering, in.uv + (around[tap] * 3.0 + vec2f(-2.5, -4.0)) * texel, 0.0).a;
    }
    let model = textureSampleLevel(image, filtering, in.uv, 0.0);
    let ink = mix(vec3f(0.33, 0.27, 0.42), vec3f(0.13, 0.11, 0.2), globals.dark);
    var result = premultiplied(vec3f(0.1, 0.1, 0.2), shadow / 8.0 * mix(0.14, 0.3, globals.dark));
    result = premultiplied(ink, outline * 0.55) + result * (1.0 - outline * 0.55);
    return model + result * (1.0 - model.a);
}
`;
