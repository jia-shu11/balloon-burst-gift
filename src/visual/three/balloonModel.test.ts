import { Box3, BufferGeometry, Material, Mesh, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { generateBalloonParams } from "../../domain/balloonParams";
import { createBalloonModel } from "./balloonModel";

function params() {
  return generateBalloonParams({
    seed: "three-dimensional-voice",
    audioDurationSec: 8,
    averageVolume: 0.1,
    peakVolume: 0.3,
    transcriptChars: 30,
    extraTextChars: 0,
    imageCount: 0,
    imageBytes: 0
  });
}

describe("createBalloonModel", () => {
  it.each([0, 1, 28])("builds finite closed body geometry with %i organic spikes", (spikeCount) => {
    const model = createBalloonModel({ ...params(), spikeCount });
    const positions = model.body.geometry.getAttribute("position");
    const normals = model.body.geometry.getAttribute("normal");
    const size = new Box3().setFromObject(model.body).getSize(new Vector3());
    const triangleIndices = model.body.geometry.index!.array;
    const edgeUses = new Map<string, number>();
    for (let triangle = 0; triangle < triangleIndices.length; triangle += 3) {
      for (let side = 0; side < 3; side++) {
        const first = triangleIndices[triangle + side];
        const second = triangleIndices[triangle + (side + 1) % 3];
        const edge = `${Math.min(first, second)}:${Math.max(first, second)}`;
        edgeUses.set(edge, (edgeUses.get(edge) ?? 0) + 1);
      }
    }

    expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
    expect(Array.from(normals.array).every(Number.isFinite)).toBe(true);
    expect([...edgeUses.values()].every((count) => count === 2)).toBe(true);
    expect(model.body.geometry.index?.count).toBeGreaterThan(100);
    expect(size.x).toBeGreaterThan(1.5);
    expect(size.x).toBeLessThan(3.5);
    expect(size.y).toBeGreaterThan(2);
    expect(size.y).toBeLessThan(4);
    model.dispose();
  });

  it("applies the supplied stretch to the body without changing the caller's transform", () => {
    const source = params();
    const original = createBalloonModel(source);
    const stretched = createBalloonModel({ ...source, stretchX: source.stretchX * 1.5, stretchY: source.stretchY * 1.4 });
    const originalSize = new Box3().setFromObject(original.body).getSize(new Vector3());
    const stretchedSize = new Box3().setFromObject(stretched.body).getSize(new Vector3());
    const vertices = Array.from(stretched.body.geometry.getAttribute("position").array);
    stretched.group.position.set(2, 3, 4);
    stretched.group.scale.setScalar(0.6);
    stretched.group.rotation.set(0.2, 0.3, 0.4);
    stretched.update(17.5, 0.8);

    expect(stretchedSize.x / originalSize.x).toBeCloseTo(1.5, 3);
    expect(stretchedSize.y / originalSize.y).toBeCloseTo(1.4, 3);
    expect(stretched.group.position.toArray()).toEqual([2, 3, 4]);
    expect(stretched.group.scale.toArray()).toEqual([0.6, 0.6, 0.6]);
    expect(stretched.group.rotation.toArray().slice(0, 3)).toEqual([0.2, 0.3, 0.4]);
    expect(Array.from(stretched.body.geometry.getAttribute("position").array)).toEqual(vertices);
    original.dispose();
    stretched.dispose();
  });

  it("releases every owned geometry and material exactly once", () => {
    const model = createBalloonModel(params());
    const resources = new Set<BufferGeometry | Material>();
    model.group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      resources.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => resources.add(material));
    });
    const disposeCounts = new Map<BufferGeometry | Material, number>();
    resources.forEach((resource) => {
      disposeCounts.set(resource, 0);
      resource.addEventListener("dispose", () => disposeCounts.set(resource, disposeCounts.get(resource)! + 1));
    });

    model.dispose();
    model.dispose();

    expect(resources.size).toBeGreaterThan(1);
    expect([...disposeCounts.values()].every((count) => count === 1)).toBe(true);
  });

  it("updates recording parameters while retaining the body buffers and physical material", () => {
    const source = params();
    const model = createBalloonModel(source);
    const geometry = model.body.geometry;
    const material = model.body.material;
    const previousColor = material.color.clone();
    const initialHeight = geometry.boundingBox!.max.y;
    model.updateParams({ ...source, hue: (source.hue + 160) % 360, stretchY: source.stretchY * 1.2, spikeCount: 8 });
    expect(model.body.geometry).toBe(geometry);
    expect(model.body.material).toBe(material);
    expect(material.color.equals(previousColor)).toBe(false);
    expect(geometry.boundingBox!.max.y).toBeGreaterThan(initialHeight);
    expect(Array.from(geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true);
    model.dispose();
  });
});
