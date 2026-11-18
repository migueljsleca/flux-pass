import * as React from "react";

import { useToolcraftMediaPresentationUrls, useToolcraftSelector } from "@/toolcraft/runtime/react";

import type { BadgeArtImages } from "./badge-art";
import {
  getBadgeImageAsset,
  getReadyBadgeImage,
  getReadyBadgePresets,
  loadBadgeImage,
  loadBadgePresets,
  type BadgeImageAsset,
} from "./badge-media";
import { BADGE_TARGETS } from "./badge-params";

export type BadgeImageAssets = Readonly<{
  photo: BadgeImageAsset | null;
}>;

/** The uploaded photo, decoded once and shared with export. */
export function useBadgeImages(
  person: string,
  ferroShape: string,
): Readonly<{ assets: BadgeImageAssets; images: BadgeArtImages }> {
  const mediaAssets = useToolcraftSelector((state) => state.mediaAssets);
  const urls = useToolcraftMediaPresentationUrls(mediaAssets);
  const assets = React.useMemo<BadgeImageAssets>(
    () => ({
      photo: getBadgeImageAsset(mediaAssets, BADGE_TARGETS.photo),
    }),
    [mediaAssets],
  );
  const [, setLoaded] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const all: (BadgeImageAsset | null)[] = [assets.photo];
    for (const asset of all) {
      if (!asset) continue;
      const url = urls.get(asset.id);
      if (!url) continue;
      void loadBadgeImage(asset, url, () => fetch(url).then((response) => response.blob()))
        .then(() => {
          if (!cancelled) setLoaded((count) => count + 1);
        })
        .catch((error: unknown) => globalThis.reportError(error));
    }
    return () => {
      cancelled = true;
    };
  }, [assets, urls]);

  // Preset person and ferrofluid shape (public/badge), decoded once each.
  React.useEffect(() => {
    let cancelled = false;
    void loadBadgePresets(person, ferroShape)
      .then(() => {
        if (!cancelled) setLoaded((count) => count + 1);
      })
      .catch((error: unknown) => globalThis.reportError(error));
    return () => {
      cancelled = true;
    };
  }, [ferroShape, person]);

  const images: BadgeArtImages = {
    ...getReadyBadgePresets(person, ferroShape),
    photo: getReadyBadgeImage(assets.photo),
  };
  return { assets, images };
}
