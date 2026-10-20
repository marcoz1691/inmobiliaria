/**
 * Panel motion. One easing everywhere: cubic-bezier(0.28, 0.11, 0.32, 1).
 * Kept as full class strings so Tailwind picks them up. `prefers-reduced-motion` is handled globally.
 */
export const ease = "ease-[cubic-bezier(0.28,0.11,0.32,1)]";

/** Color/background feedback on controls. */
export const tap = `transition-[background-color,color,box-shadow,scale,opacity] duration-200 ${ease}`;

/** Press feedback: a light squeeze, like a native control. */
export const press = "active:scale-[0.97]";
