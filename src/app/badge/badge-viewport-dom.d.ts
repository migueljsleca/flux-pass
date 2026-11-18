export type BadgeWindowSize = Readonly<{ height: number; width: number }>;

/** Stops wheel and pinch events aimed at `getTarget()` before canvas navigation sees them. */
export declare function blockBadgeViewportNavigation(getTarget: () => HTMLCanvasElement | null): () => void;

/** Calls `onChange` with the window size now and on every resize. */
export declare function watchBadgeWindowSize(onChange: (size: BadgeWindowSize) => void): () => void;
