import * as THREE from "three";
import type { BalloonParams } from "../../domain/types";

export interface BalloonModel {
  group: THREE.Group;
  body: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  update(time: number, level?: number): void;
  updateParams(params: BalloonParams): void;
  dispose(): void;
}

/** Unit balloon, facing +Z. The caller owns the returned group's transform. */
export function createBalloonModel(params: BalloonParams): BalloonModel {
  const group = new THREE.Group();
  group.name = "voice-balloon";
  const floating = new THREE.Group();
  group.add(floating);

  let stretchX = THREE.MathUtils.clamp(params.stretchX, 0.5, 2);
  let height = 1.25 * THREE.MathUtils.clamp(params.stretchY / 1.12, 0.5, 2);
  const phase = (params.hue / 360) * Math.PI * 2;
  let spikeCount = THREE.MathUtils.clamp(Math.round(params.spikeCount), 0, 28);
  let spikeLength = THREE.MathUtils.clamp(params.spikeLength, 0, 0.32);
  function createSpikes() { return Array.from({ length: spikeCount }, (_, index) => {
    const y = 0.92 - (1.5 * (index + 0.5)) / spikeCount;
    const angle = index * 2.399963229728653 + phase;
    const radius = Math.sqrt(1 - y * y);
    return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
  }); }
  let spikes = createSpikes();

  // A pear profile and compact radial lobes are evaluated once, including the
  // waveform, so the signature follows the same inflated surface as the shell.
  function surfacePoint(direction: THREE.Vector3) {
    const y = direction.y;
    const angle = Math.atan2(direction.z, direction.x);
    const shoulder = 0.94 + y * 0.14;
    const ripple = 0.004 * params.wobble * (1 - y * y)
      * Math.sin(angle * params.surfaceWaveDensity + phase) * Math.cos(y * 7);
    let extension = 0;
    for (const spike of spikes) {
      const influence = Math.max(0, (direction.dot(spike) - 0.964) / 0.036);
      extension += spikeLength * influence * influence * influence;
    }
    const inflation = 1 + extension + ripple;
    return new THREE.Vector3(
      direction.x * shoulder * stretchX * inflation,
      y * height * inflation,
      direction.z * shoulder * inflation
    );
  }

  // Shared poles and wrapped ring indices keep this mesh watertight and avoid
  // the visible normal seam produced by deforming a UV-seamed sphere.
  const longitudeSegments = 96;
  const latitudeSegments = 64;
  const vertices: number[] = [0, height, 0];
  const indices: number[] = [];
  for (let latitude = 1; latitude < latitudeSegments; latitude++) {
    const theta = (latitude / latitudeSegments) * Math.PI;
    for (let longitude = 0; longitude < longitudeSegments; longitude++) {
      const phi = (longitude / longitudeSegments) * Math.PI * 2;
      const point = surfacePoint(new THREE.Vector3(
        Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)
      ));
      vertices.push(point.x, point.y, point.z);
    }
  }
  const bottomIndex = vertices.length / 3;
  vertices.push(0, -height, 0);
  for (let longitude = 0; longitude < longitudeSegments; longitude++) {
    const next = (longitude + 1) % longitudeSegments;
    indices.push(0, 1 + next, 1 + longitude);
    for (let latitude = 0; latitude < latitudeSegments - 2; latitude++) {
      const a = 1 + latitude * longitudeSegments + longitude;
      const b = 1 + latitude * longitudeSegments + next;
      const c = a + longitudeSegments;
      const d = b + longitudeSegments;
      indices.push(a, b, c, b, d, c);
    }
    const lastRing = 1 + (latitudeSegments - 2) * longitudeSegments;
    indices.push(lastRing + longitude, lastRing + next, bottomIndex);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const hue = (((params.hue % 360) + 360) % 360) / 360;
  const color = new THREE.Color().setHSL(hue, 0.5, THREE.MathUtils.clamp(params.lightness / 100, 0.32, 0.82), THREE.SRGBColorSpace);
  const latex = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.22,
    metalness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.13,
    ior: 1.45,
    transmission: 0.055,
    thickness: 0.35,
    attenuationColor: color,
    attenuationDistance: 1.2,
    iridescence: 0.16,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [180, 310],
    sheen: 0.18,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color("#fff3e7"),
    envMapIntensity: 1.2,
    emissive: color,
    emissiveIntensity: 0.015
  });
  const body = new THREE.Mesh(geometry, latex);
  body.name = "inflated-latex-body";
  body.castShadow = true;
  body.receiveShadow = true;
  floating.add(body);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.067, 0.15, 16), latex);
  neck.position.set(0.007, -height - 0.047, 0);
  neck.rotation.z = 0.12;
  neck.castShadow = true;
  floating.add(neck);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.061, 0.011, 6, 20), latex);
  rim.rotation.x = Math.PI / 2;
  rim.rotation.y = 0.12;
  rim.position.set(0.016, -height - 0.122, 0);
  floating.add(rim);

  const threadPivot = new THREE.Group();
  threadPivot.position.set(0, -height - 0.06, 0);
  floating.add(threadPivot);
  const stringLength = THREE.MathUtils.clamp(params.stringLength / Math.max(42, params.radius), 0.55, 1.55);
  const threadCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.025, -stringLength * 0.18, 0.02),
    new THREE.Vector3(0.075, -stringLength * 0.48, 0.045),
    new THREE.Vector3(0.01, -stringLength * 0.76, 0.025),
    new THREE.Vector3(-0.07, -stringLength, 0.035)
  ]);
  const thread = new THREE.Mesh(
    new THREE.TubeGeometry(threadCurve, 40, 0.006, 5, false),
    new THREE.MeshStandardMaterial({ color: "#dbc5a6", roughness: 0.48, metalness: 0.3 })
  );
  thread.name = "silk-thread";
  thread.castShadow = true;
  threadPivot.add(thread);

  function signatureCurve() {
    const contour = params.voiceSignature.waveformContour;
    const signaturePoints = Array.from({ length: 49 }, (_, index) => {
    const progress = index / 48;
    const sample = contour[Math.min(contour.length - 1, Math.floor(progress * contour.length))] ?? 0;
    const x = (progress - 0.5) * 0.73;
    const y = THREE.MathUtils.clamp(sample, -1, 1) * 0.115 - 0.025;
    const direction = new THREE.Vector3(x, y, Math.sqrt(1 - x * x - y * y));
    return surfacePoint(direction).addScaledVector(direction, 0.01);
    });
    return new THREE.CatmullRomCurve3(signaturePoints);
  }
  const signature = new THREE.Mesh(
    new THREE.TubeGeometry(signatureCurve(), 120, 0.005, 5, false),
    new THREE.MeshStandardMaterial({
      color: "#fffaf1", roughness: 0.3, metalness: 0.1,
      emissive: "#fff0db", emissiveIntensity: 0.12
    })
  );
  signature.name = "voice-signature";
  signature.visible = params.voiceSignature.waveformContour.some((value) => Math.abs(value) > 0.015);
  floating.add(signature);

  function shapeKey(value: BalloonParams) {
    return [value.stretchX, value.stretchY, value.spikeCount, value.spikeLength, value.wobble, value.surfaceWaveDensity].map((number) => Math.round(number * 50)).join(",");
  }
  let lastShape = shapeKey(params);
  let lastContour = params.voiceSignature.waveformContour.map((value) => Math.round(value * 50)).join(",");

  let disposed = false;
  return {
    group,
    body,
    updateParams(next) {
      if (disposed) return;
      params = next;
      signature.visible = params.voiceSignature.waveformContour.some((value) => Math.abs(value) > 0.015);
      const nextShape = shapeKey(next);
      const nextContour = next.voiceSignature.waveformContour.map((value) => Math.round(value * 50)).join(",");
      const shapeChanged = nextShape !== lastShape;
      if (shapeChanged) {
        stretchX = THREE.MathUtils.clamp(params.stretchX, 0.5, 2);
        height = 1.25 * THREE.MathUtils.clamp(params.stretchY / 1.12, 0.5, 2);
        spikeCount = THREE.MathUtils.clamp(Math.round(params.spikeCount), 0, 28);
        spikeLength = THREE.MathUtils.clamp(params.spikeLength, 0, 0.32);
        spikes = createSpikes();
        const position = geometry.getAttribute("position") as THREE.BufferAttribute;
        position.setXYZ(0, 0, height, 0);
        for (let latitude = 1; latitude < latitudeSegments; latitude += 1) {
          const theta = latitude / latitudeSegments * Math.PI;
          for (let longitude = 0; longitude < longitudeSegments; longitude += 1) {
            const phi = longitude / longitudeSegments * Math.PI * 2;
            const point = surfacePoint(new THREE.Vector3(Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)));
            position.setXYZ(1 + (latitude - 1) * longitudeSegments + longitude, point.x, point.y, point.z);
          }
        }
        position.setXYZ(bottomIndex, 0, -height, 0);
        position.needsUpdate = true;
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        neck.position.y = -height - 0.047;
        rim.position.y = -height - 0.122;
        threadPivot.position.y = -height - 0.06;
        lastShape = nextShape;
      }
      if (shapeChanged || nextContour !== lastContour) {
        const previous = signature.geometry;
        signature.geometry = new THREE.TubeGeometry(signatureCurve(), 120, 0.005, 5, false);
        previous.dispose();
        lastContour = nextContour;
      }
      threadPivot.scale.y = THREE.MathUtils.clamp(params.stringLength / Math.max(42, params.radius), 0.55, 1.55) / stringLength;
      color.setHSL((((params.hue % 360) + 360) % 360) / 360, 0.5, THREE.MathUtils.clamp(params.lightness / 100, 0.32, 0.82), THREE.SRGBColorSpace);
      latex.color.copy(color);
      latex.attenuationColor.copy(color);
      latex.emissive.copy(color);
    },
    update(time, level = 0) {
      if (disposed) return;
      const energy = THREE.MathUtils.clamp(level, 0, 1);
      const breath = Math.sin(time * 1.4 + phase) * 0.006 + energy * 0.022;
      floating.scale.set(1 + breath, 1 - breath * 0.4, 1 + breath);
      floating.rotation.z = Math.sin(time * 0.63 + phase) * 0.018;
      floating.rotation.x = Math.cos(time * 0.49 + phase) * 0.008;
      threadPivot.rotation.z = Math.sin(time * 1.1 + phase) * (0.04 + energy * 0.035);
      threadPivot.rotation.x = Math.cos(time * 0.8 + phase) * 0.025;
      latex.emissiveIntensity = 0.015 + energy * 0.04;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
      });
      geometries.forEach((ownedGeometry) => ownedGeometry.dispose());
      materials.forEach((material) => material.dispose());
      group.removeFromParent();
      group.clear();
    }
  };
}
