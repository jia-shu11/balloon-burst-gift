import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { SceneVariant } from "./types";

/** Entire room is modeled geometry; the studio environment is generated locally. */
export function createSceneEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer, variant: SceneVariant) {
  const resources: Array<{ dispose(): void }> = [];
  const keep = <T extends { dispose(): void }>(resource: T): T => { resources.push(resource); return resource; };
  const color = new THREE.Color("#e7dfd0");
  scene.background = color;
  scene.fog = new THREE.FogExp2(color, 0.025);
  const studio = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = keep(pmrem.fromScene(studio, 0.03));
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.8;
  studio.dispose();
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xfff8e8, 0xaaa087, 0.7));
  const key = new THREE.DirectionalLight(0xffedd5, 3.2);
  key.position.set(-5, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -13, right: 13, top: 10, bottom: -8, near: 0.5, far: 35 });
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.0001;
  key.shadow.radius = 4;
  key.shadow.blurSamples = 8;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffdca5, 2.3);
  rim.position.set(5, 4, -5);
  scene.add(rim);
  const cool = new THREE.DirectionalLight(0xd7e6eb, 0.65);
  cool.position.set(7, 3, 6);
  scene.add(cool);

  const stone = keep(new THREE.MeshStandardMaterial({ color: 0xeee6d8, roughness: 0.48, metalness: 0.12 }));
  const warmStone = keep(new THREE.MeshStandardMaterial({ color: 0xd1c1a8, roughness: 0.65, metalness: 0.08 }));
  const brass = keep(new THREE.MeshStandardMaterial({ color: 0xb6a276, roughness: 0.27, metalness: 0.78 }));
  const architecture = new THREE.Group();
  scene.add(architecture);
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(200, 200)), stone);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.6;
  floor.receiveShadow = true;
  architecture.add(floor);

  const center = variant === "hero" ? 3.1 : 0;
  const plinthRadius = variant === "preview" ? 1.8 : 3.2;
  for (const [radius, height, y, material] of [
    [plinthRadius + 0.25, 0.12, -2.52, warmStone],
    [plinthRadius, 0.32, -2.3, stone],
    [plinthRadius + 0.01, 0.025, -2.135, stone]
  ] as const) {
    const disc = new THREE.Mesh(keep(new THREE.CylinderGeometry(radius, radius, height, 96)), material);
    disc.position.set(center, y, 0);
    disc.receiveShadow = true;
    disc.castShadow = true;
    architecture.add(disc);
  }

  // Three nested, extruded architectural arches give real occlusion and depth.
  for (let index = 0; index < 3; index += 1) {
    const radius = 3.0 + index * 0.5;
    const thickness = 0.16;
    const shape = new THREE.Shape();
    shape.moveTo(-radius, -4);
    shape.lineTo(-radius, 0);
    shape.absarc(0, 0, radius, Math.PI, 0, true);
    shape.lineTo(radius, -4);
    shape.lineTo(radius - thickness, -4);
    shape.lineTo(radius - thickness, 0);
    shape.absarc(0, 0, radius - thickness, 0, Math.PI, false);
    shape.lineTo(-radius + thickness, -4);
    shape.closePath();
    const geometry = keep(new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.04, bevelSegments: 3, steps: 1, curveSegments: 64 }));
    const arch = new THREE.Mesh(geometry, index === 1 ? brass : warmStone);
    arch.position.set(center, 0.55, -3.7 - index * 0.55);
    arch.castShadow = true;
    arch.receiveShadow = true;
    architecture.add(arch);
  }

  // Fine, physical floor inlays catch the warm key light.
  for (let index = 0; index < 3; index += 1) {
    const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(plinthRadius + 1.1 + index * 1.3, 0.012, 5, 128)), brass);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(center, -2.59, 0);
    architecture.add(ring);
  }

  const dustGeometry = keep(new THREE.BufferGeometry());
  const positions = new Float32Array(160 * 3);
  for (let index = 0; index < 160; index += 1) {
    positions[index * 3] = Math.sin(index * 73.3) * 10;
    positions[index * 3 + 1] = Math.cos(index * 17.1) * 5 + 1;
    positions[index * 3 + 2] = Math.sin(index * 32.7) * 6;
  }
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const dustMaterial = keep(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { color: { value: new THREE.Color(0xfff4cc) } },
    vertexShader: "void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(24.0/-p.z,1.0,4.0);}",
    fragmentShader: "uniform vec3 color;void main(){float a=1.0-smoothstep(0.1,0.5,length(gl_PointCoord-0.5));gl_FragColor=vec4(color,a*0.7);}"
  }));
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dust);
  return {
    setFloorHeight(y: number) { architecture.position.y = y + 2.6; },
    update(time: number) { dust.rotation.y = time * 0.012; dust.position.y = Math.sin(time * 0.15) * 0.15; },
    dispose() { key.shadow.dispose(); resources.forEach((resource) => resource.dispose()); }
  };
}
