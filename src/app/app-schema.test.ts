import { describe, expect, it } from "vitest";

import {
  appAcceptance,
  validateProductAcceptanceCoverage,
} from "./app-acceptance";
import { appPerformance } from "./app-performance";
import { appSchema } from "./app-schema";

describe("appSchema", () => {
  it("assembles Flux Pass with one locked view, image export and no timeline", () => {
    expect(appSchema.canvas.sizing).toEqual({ mode: "fixed-output" });
    expect(appSchema.canvas.size).toEqual({ height: 1080, unit: "px", width: 1920 });
    expect(appSchema.canvas.draggable).toBe(false);
    expect(appSchema.toolbar).toMatchObject({ radar: false, zoom: false });
    expect(appSchema.canvas.upload).toBe(false);
    expect(appSchema.panels.timeline).toBeUndefined();
    const moduleIds = appSchema.modulePlan.modules.map(({ id }) => id);
    expect(moduleIds).toEqual(expect.arrayContaining(["image-export"]));
    expect(moduleIds).not.toContain("video-export");
    const titles = appSchema.panels.controls?.sections.map((section) => section.title) ?? [];
    expect(titles).toEqual(
      expect.arrayContaining(["Card", "Role", "Name", "Person", "Upload person", "Ferrofluid", "Lanyard", "Physics", "Camera"]),
    );
  });

  it("declares a custom WebGL renderer workload", () => {
    expect(appPerformance.usesCustomRenderer).toBe(true);
    expect(appPerformance.workloadEnvelope.dimensions.map(({ id }) => id)).toEqual([
      "preview-pixels",
      "export-long-edge",
      "export-pixels",
    ]);
    expect(appPerformance.scenarios.length).toBeGreaterThan(0);
  });

  it("declares production reload coverage for the badge workspace", () => {
    expect(appSchema.persistence.storage).toBe("localStorage");
    if (appSchema.persistence.storage !== "localStorage") {
      throw new Error("Flux Pass must persist its workspace in localStorage.");
    }
    expect(appSchema.persistence.include).toEqual(expect.arrayContaining(["canvas", "values", "panels", "media"]));
    expect(appAcceptance.find((entry) => entry.id === "persistence.reload")).toMatchObject({
      evidence: "persistence-state",
      persistenceCoverage: "reload",
      persistenceSlices: appSchema.persistence.include,
    });
    // The only remaining contract errors are the user-approved fixed-output exception.
    expect(validateProductAcceptanceCoverage().every((error) => error.includes('"editable-output"'))).toBe(true);
  });
});
