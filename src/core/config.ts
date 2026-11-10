/** Central tuning constants. Keep gameplay values here so they are easy to adjust. */

export const FIXED_DT = 1 / 60;
export const MAX_SUBSTEPS = 4;
export const GRAVITY = -9.81;

/** Hard cap on simulated (non-static) bodies. Oldest entities are evicted first. */
export const MAX_BODIES = 900;
/** Entities that fall below this height are deleted. */
export const KILL_PLANE = -50;

export const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 1.2, 0];
export const DEFAULT_CAMERA_DISTANCE = 16;
export const DEFAULT_CAMERA_AZIMUTH = -0.7;
export const DEFAULT_CAMERA_POLAR = 1.02;

export const MAX_PARTICLES = 1600;
export const MAX_SHOCKWAVES = 8;
export const MAX_SCORCHES = 24;
export const MAX_FRAGMENTS_PER_OBJECT = 18;

export const MAX_FLUID_PARTICLES = 48;
export const MAX_CLOTH_PARTICLES = 64;
export const MAX_SOFT_PARTICLES = 48;

export const PLAYER_GRAB_FORCE = 1;
export const PROJECTILE_LIFETIME = 18;

export const SHADOW_MAP_SIZE = 2048;
export const MAX_PIXEL_RATIO = 2;
