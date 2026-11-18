import * as React from "react";

import {
  useToolcraftEvaluatedValues,
  useToolcraftPipeline,
  useToolcraftProductSceneFrame,
  useToolcraftViewportInteractionActive,
} from "@/toolcraft/runtime/react";

import { getBadgeArt } from "./badge-art";
import { getBadgeCamera } from "./badge-camera";
import styles from "./badge-canvas.module.css";
import { useBadgeImages } from "./badge-images";
import { getBadgeRigLayouts } from "./badge-layout";
import { onBadgeDropRequest, setBadgeLivePoses } from "./badge-live";
import { describeBadgeImage } from "./badge-media";
import { readBadgeParams, type BadgeParams } from "./badge-params";
import { BadgePhysics, BadgeWorld, type Vec3 } from "./badge-physics";
import {
  badgePreviewRenderPass,
  badgePreviewScenePass,
} from "./badge-pipeline";
import { BadgeScene } from "./badge-scene";
import { useBadgeViewportLock } from "./badge-viewport";

/** Preview backing: CSS size x device pixel ratio (capped at 2 for retina sharpness). */
export function getBadgePreviewBacking(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
): Readonly<{ height: number; width: number }> {
  const ratio = Math.min(2, Math.max(1, devicePixelRatio || 1));
  return {
    height: Math.max(1, Math.round(cssHeight * ratio)),
    width: Math.max(1, Math.round(cssWidth * ratio)),
  };
}

function toPhysicsSettings(params: BadgeParams) {
  return {
    drag: params.drag,
    gravity: params.gravity,
    strapLength: params.strapLength,
  };
}

let nextCanvasId = 0;

type Grab = { index: number; pointerId: number; plane: Vec3; u: number; v: number };

function BadgeCanvasSurface({
  cssHeight,
  cssWidth,
}: Readonly<{ cssHeight: number; cssWidth: number }>): React.JSX.Element {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const sceneRef = React.useRef<BadgeScene | null>(null);
  const mountCountRef = React.useRef(0);
  const [sceneReady, setSceneReady] = React.useState(false);
  const [canvasId] = React.useState(
    () => `badge-preview-${(nextCanvasId += 1)}`,
  );
  const pipeline = useToolcraftPipeline();
  const values = useToolcraftEvaluatedValues();
  const params = React.useMemo(() => readBadgeParams(values), [values]);
  const { assets, images } = useBadgeImages(params.person, params.ferroShape);
  const art = getBadgeArt(params, images);
  const viewportActive = useToolcraftViewportInteractionActive();
  const devicePixelRatio =
    typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const backing = getBadgePreviewBacking(cssWidth, cssHeight, devicePixelRatio);

  // One simulation per badge on screen; rebuilt (with a drop-in) when the layout changes.
  // Badges share one world so their cards collide.
  const physicsRef = React.useRef<{ layout: string; world: BadgeWorld } | null>(null);
  if (physicsRef.current === null || physicsRef.current.layout !== params.layout) {
    const settings = toPhysicsSettings(params);
    physicsRef.current = {
      layout: params.layout,
      world: new BadgeWorld(
        getBadgeRigLayouts(params.layout).map((rig) => new BadgePhysics(settings, { ...rig, drop: true })),
      ),
    };
  }
  const grabRef = React.useRef<Grab | null>(null);
  useBadgeViewportLock(canvasRef);
  const [hovering, setHovering] = React.useState(false);
  const [grabbing, setGrabbing] = React.useState(false);

  // Latest inputs for the animation loop.
  const latest = React.useRef({ art, backing, params, viewportActive });
  latest.current = { art, backing, params, viewportActive };

  // Retained preview scene, owned by the renderer pipeline.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pipeline) return undefined;
    let cancelled = false;
    mountCountRef.current += 1;
    const resourceKey = `${canvasId}:${mountCountRef.current}`;
    void pipeline
      .runPass(
        badgePreviewScenePass,
        { "renderer.preview-scene": resourceKey },
        (context) =>
          context.getOrCreateResource(
            [resourceKey],
            () =>
              new BadgeScene({
                antialias: true,
                canvas,
                preserveDrawingBuffer: true,
              }),
            (owned) => owned.dispose(),
          ),
      )
      .then((scene) => {
        if (cancelled) return;
        sceneRef.current = scene;
        setSceneReady(true);
      })
      .catch((error: unknown) => globalThis.reportError(error));
    return () => {
      cancelled = true;
      sceneRef.current = null;
      setSceneReady(false);
      void pipeline
        .invalidatePass(badgePreviewScenePass)
        .cleanup.catch(() => undefined);
    };
  }, [canvasId, pipeline]);

  const frameRef = React.useRef(0);
  const lastTimeRef = React.useRef<number | null>(null);
  const framesRef = React.useRef(0);

  const renderFrame = React.useCallback(
    (now: number) => {
      frameRef.current = 0;
      const scene = sceneRef.current;
      const world = physicsRef.current?.world;
      const canvas = canvasRef.current;
      if (!scene || !world || !canvas || !pipeline) return;
      const state = latest.current;
      const last = lastTimeRef.current;
      lastTimeRef.current = now;
      // The canvas viewport moving (pan/zoom) suspends the simulation; it resumes in place.
      if (!state.viewportActive && last !== null) world.advance((now - last) / 1000);
      const poses = world.snapshots();
      const awake = world.awake;
      setBadgeLivePoses(poses);
      void pipeline
        .runPass(badgePreviewRenderPass, undefined, () => {
          scene.update(state.params, state.art, poses);
          scene.render(
            state.backing.width,
            state.backing.height,
            getBadgeCamera(
              state.params,
              state.backing.width / state.backing.height,
            ),
          );
        })
        .then(() => {
          framesRef.current += 1;
          canvas.dataset.badgeFrameCount = String(framesRef.current);
          canvas.dataset.badgeAwake = String(awake);
          canvas.dataset.badgeCount = String(poses.length);
          canvas.dataset.badgeContacts = String(world.contacts);
        })
        .catch((error: unknown) => globalThis.reportError(error));
      if (awake && !state.viewportActive) {
        frameRef.current = window.requestAnimationFrame(renderFrame);
      } else {
        lastTimeRef.current = null;
      }
    },
    [pipeline],
  );

  const requestFrame = React.useCallback(() => {
    if (frameRef.current !== 0) return;
    frameRef.current = window.requestAnimationFrame(renderFrame);
  }, [renderFrame]);

  React.useEffect(
    () => () => {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    },
    [],
  );

  // Settings feed the simulation (and wake it so the badge reacts).
  React.useEffect(() => {
    physicsRef.current?.world.setSettings(toPhysicsSettings(params));
  }, [params]);

  React.useEffect(
    () =>
      onBadgeDropRequest(() => {
        physicsRef.current?.world.reset(true);
        requestFrame();
      }),
    [requestFrame],
  );

  // Redraw whenever an input changes; the loop keeps going while the badge moves.
  React.useEffect(() => {
    if (!sceneReady || viewportActive) return;
    requestFrame();
  }, [
    art,
    backing.height,
    backing.width,
    params,
    requestFrame,
    sceneReady,
    viewportActive,
  ]);

  React.useEffect(() => () => setBadgeLivePoses(null), []);

  const toNdc = React.useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return [
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -(((clientY - rect.top) / rect.height) * 2 - 1),
      ];
    },
    [],
  );

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>): void {
    if (event.button !== 0 || grabRef.current) return;
    const scene = sceneRef.current;
    const ndc = toNdc(event.clientX, event.clientY);
    if (!scene || !ndc) return;
    const hit = scene.hitCard(ndc[0], ndc[1]);
    const physics = hit ? physicsRef.current?.world.bodies[hit.index] : undefined;
    if (!hit || !physics) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    grabRef.current = {
      index: hit.index,
      plane: hit.point,
      pointerId: event.pointerId,
      u: hit.u,
      v: hit.v,
    };
    physics.setGrab({ target: hit.point, u: hit.u, v: hit.v });
    setGrabbing(true);
    requestFrame();
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>): void {
    const scene = sceneRef.current;
    const ndc = toNdc(event.clientX, event.clientY);
    if (!scene || !ndc) return;
    const grab = grabRef.current;
    if (grab && grab.pointerId === event.pointerId) {
      event.stopPropagation();
      const target = scene.pointerOnPlane(ndc[0], ndc[1], grab.plane);
      if (target) physicsRef.current?.world.bodies[grab.index]?.setGrab({ target, u: grab.u, v: grab.v });
      requestFrame();
      return;
    }
    if (event.pointerType === "mouse")
      setHovering(scene.hitCard(ndc[0], ndc[1]) !== null);
  }

  function release(event: React.PointerEvent<HTMLCanvasElement>): void {
    const grab = grabRef.current;
    if (!grab || grab.pointerId !== event.pointerId) return;
    event.stopPropagation();
    grabRef.current = null;
    physicsRef.current?.world.bodies[grab.index]?.setGrab(null);
    setGrabbing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    requestFrame();
  }

  return (
    <canvas
      className={styles.canvas}
      data-badge-backing={`${backing.width}x${backing.height}`}
      data-badge-canvas=""
      data-badge-grabbing={String(grabbing)}
      data-badge-hover={String(hovering)}
      data-badge-photo={describeBadgeImage(assets.photo)}
      data-badge-presentation={canvasId}
      data-badge-viewport-active={String(viewportActive)}
      data-toolcraft-canvas-handle=""
      data-toolcraft-product-output=""
      onLostPointerCapture={release}
      onPointerCancel={release}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      ref={canvasRef}
    />
  );
}

export function BadgeCanvas(): React.JSX.Element | null {
  const frame = useToolcraftProductSceneFrame();
  if (frame.kind !== "ready") return null;
  return (
    <BadgeCanvasSurface
      cssHeight={frame.rect.height}
      cssWidth={frame.rect.width}
    />
  );
}
