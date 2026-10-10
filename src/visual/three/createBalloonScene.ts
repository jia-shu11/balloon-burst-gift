import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { createBalloonModel } from "./balloonModel";
import { createSceneEnvironment } from "./sceneEnvironment";
import { qualityPixelRatio, stageToWorld, worldToStage } from "./sceneMath";
import type { SceneBalloon, SceneState, SceneVariant } from "./types";

type Model = ReturnType<typeof createBalloonModel>;
interface Entry { item: SceneBalloon; model: Model; base: THREE.Vector3; scale: number; phase: number; pokeAt: number; updatedAt: number; renderedParams: SceneBalloon["params"] }
interface Burst { mesh: THREE.InstancedMesh; age: number; origin: THREE.Vector3; velocities: THREE.Vector3[] }

const heroPlacement = [
  [2.7, 1.7, 0.7, 1.0], [4.1, 0.85, 0.1, 0.86], [1.25, 0.1, 0.5, 0.78],
  [3.15, -0.22, 1.0, 0.68], [4.55, 2.45, -1, 0.63], [1.4, 2.8, -1.2, 0.58], [5.3, 0.1, -0.6, 0.55]
];

export function createBalloonScene(canvas: HTMLCanvasElement, variant: SceneVariant, initial: SceneState, onClick: (id: string, point: { x: number; y: number }) => void) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const environment = createSceneEnvironment(scene, renderer, variant);
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 });
  const composer = new EffectComposer(renderer, target);
  const renderPass = new RenderPass(scene, camera);
  const occlusion = new SSAOPass(scene, camera, 1, 1, 12);
  occlusion.kernelRadius = 12;
  occlusion.minDistance = 0.002;
  occlusion.maxDistance = 0.085;
  const depthOfField = new BokehPass(scene, camera, { focus: 14, aperture: 0.00006, maxblur: 0.003 });
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.14, 0.35, 1.25);
  const output = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(occlusion);
  composer.addPass(depthOfField);
  composer.addPass(bloom);
  composer.addPass(output);
  const models = new Map<string, Entry>();
  const bursts: Burst[] = [];
  const confettiGeometry = new THREE.PlaneGeometry(0.075, 0.11);
  const confettiMaterial = new THREE.MeshStandardMaterial({ color: 0xffeac4, metalness: 0.65, roughness: 0.3, side: THREE.DoubleSide });
  const instance = new THREE.Object3D();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const aim = new THREE.Vector2();
  let state = initial;
  let disposed = false;
  let visible = true;
  let animation = 0;
  let elapsed = 0;
  let previousTime = performance.now();
  let previousBurstIds = new Set(initial.burstIds);
  let width = 1;
  let height = 1;
  let pointerDown: { x: number; y: number } | null = null;
  let previousPointer: { x: number; y: number } | null = null;
  let dragging = false;
  let orbitX = 0;
  let orbitY = 0;
  const cameraHome = new THREE.Vector3();
  const cameraLook = new THREE.Vector3();

  function positionModels() {
    camera.updateMatrixWorld();
    let index = 0;
    for (const entry of models.values()) {
      if (variant === "recipient") {
        const stagePoint = { x: entry.item.x ?? state.stageSize.width / 2, y: entry.item.y ?? state.stageSize.height / 2 };
        const depth = entry.item.z ?? Math.sin(index * 2.7) * 0.7;
        entry.base.copy(stageToWorld(stagePoint, state.stageSize, camera, depth));
        const displayRadius = entry.item.params.radius * Math.min(1.6, Math.max(1, state.stageSize.height / state.stageSize.width));
        const edge = stageToWorld({ x: stagePoint.x + displayRadius, y: stagePoint.y }, state.stageSize, camera, depth);
        entry.scale = edge.distanceTo(entry.base);
      } else if (variant === "preview") {
        entry.base.set(0, 0.5, 0);
        entry.scale = THREE.MathUtils.clamp(entry.item.params.radius / 95, 0.55, 1.55);
      } else {
        const pose = heroPlacement[index % heroPlacement.length];
        entry.base.set(pose[0], pose[1], pose[2]);
        entry.scale = pose[3];
      }
      entry.model.group.position.copy(entry.base);
      entry.model.group.scale.setScalar(entry.scale);
      index += 1;
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    const aspect = width / height;
    camera.aspect = aspect;
    const mobile = aspect < 0.9;
    if (variant === "hero") {
      cameraHome.set(mobile ? 3 : 0, mobile ? 6.5 : 2.0, mobile ? 24 : 14.5);
      cameraLook.set(mobile ? 3 : 0, mobile ? 5.0 : 0.75, 0);
    } else if (variant === "preview") {
      cameraHome.set(0, 1.0, 10.5);
      cameraLook.set(0, 0, 0);
    } else {
      cameraHome.set(0, 0, mobile ? 18 : 14.5);
      cameraLook.set(0, 0, 0);
    }
    camera.position.copy(cameraHome);
    camera.lookAt(cameraLook);
    camera.updateProjectionMatrix();
    if (variant === "recipient") environment.setFloorHeight(-Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z - 0.7);
    renderer.setPixelRatio(qualityPixelRatio(window.devicePixelRatio, state.quality));
    renderer.setSize(width, height, false);
    composer.setPixelRatio(qualityPixelRatio(window.devicePixelRatio, state.quality));
    composer.setSize(width, height);
    occlusion.setSize(Math.max(1, Math.round(width * 0.65)), Math.max(1, Math.round(height * 0.65)));
    depthOfField.materialBokeh.uniforms.focus.value = camera.position.distanceTo(cameraLook);
    positionModels();
  }

  function addBurst(entry: Entry) {
    const mesh = new THREE.InstancedMesh(confettiGeometry, confettiMaterial, 56);
    const velocities: THREE.Vector3[] = [];
    const color = new THREE.Color();
    for (let index = 0; index < 56; index += 1) {
      const angle = index * 2.399963;
      const vy = 1 - index / 55 * 2;
      const ring = Math.sqrt(1 - vy * vy);
      velocities.push(new THREE.Vector3(Math.cos(angle) * ring, vy + 0.7, Math.sin(angle) * ring).multiplyScalar(1.6 + index % 5 * 0.25));
      color.setHSL(((entry.item.params.hue + index * 2) % 360) / 360, 0.38, 0.6 + index % 3 * 0.09);
      mesh.setColorAt(index, color);
      instance.position.copy(entry.model.group.position);
      instance.scale.setScalar(0.01);
      instance.updateMatrix();
      mesh.setMatrixAt(index, instance.matrix);
    }
    mesh.frustumCulled = false;
    scene.add(mesh);
    bursts.push({ mesh, velocities, age: 0, origin: entry.model.group.position.clone() });
    // Limit transient GPU work when a large room is burst all at once.
    if (bursts.length > 16) { const oldest = bursts.shift()!; scene.remove(oldest.mesh); oldest.mesh.dispose(); }
  }

  function update(next: SceneState) {
    const qualityChanged = next.quality !== state.quality;
    const sizeChanged = next.stageSize.width !== state.stageSize.width || next.stageSize.height !== state.stageSize.height;
    state = next;
    const nextIds = new Set(next.balloons.map((item) => item.id));
    for (const [id, entry] of models) {
      if (!nextIds.has(id)) { scene.remove(entry.model.group); entry.model.dispose(); models.delete(id); }
    }
    for (const [index, item] of next.balloons.entries()) {
      let entry = models.get(item.id);
      if (!entry) {
        const model = createBalloonModel(item.params);
        model.body.userData.balloonId = item.id;
        entry = { item, model, base: new THREE.Vector3(), scale: 1, phase: index * 2.1, pokeAt: -10, updatedAt: performance.now(), renderedParams: item.params };
        models.set(item.id, entry);
        scene.add(model.group);
      }
      entry.item = item;
      if (next.burstIds.has(item.id) && !previousBurstIds.has(item.id)) addBurst(entry);
      entry.model.group.visible = !next.excludedIds.has(item.id);
    }
    previousBurstIds = new Set(next.burstIds);
    positionModels();
    if (qualityChanged || sizeChanged) resize();
  }

  function pick(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const targets = Array.from(models.values()).filter((entry) => entry.model.group.visible).map((entry) => entry.model.body);
    return raycaster.intersectObjects(targets, false)[0];
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    pointerDown = { x: event.clientX, y: event.clientY };
    previousPointer = pointerDown;
    dragging = false;
  }
  function onPointerMove(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    aim.set((event.clientX - rect.left) / rect.width - 0.5, (event.clientY - rect.top) / rect.height - 0.5);
    if (pointerDown && event.buttons === 1 && variant !== "recipient") {
      const dx = event.clientX - previousPointer!.x;
      const dy = event.clientY - previousPointer!.y;
      if (Math.abs(event.clientX - pointerDown.x) + Math.abs(event.clientY - pointerDown.y) > 6) dragging = true;
      orbitX = THREE.MathUtils.clamp(orbitX + dx * 0.003, -1.4, 1.4);
      orbitY = THREE.MathUtils.clamp(orbitY + dy * 0.002, -0.4, 0.6);
      previousPointer = { x: event.clientX, y: event.clientY };
    }
    canvas.style.cursor = pick(event.clientX, event.clientY) ? "pointer" : variant === "recipient" ? "default" : "grab";
  }
  function onPointerUp(event: PointerEvent) {
    if (!pointerDown) return;
    const traveled = Math.abs(event.clientX - pointerDown.x) + Math.abs(event.clientY - pointerDown.y);
    pointerDown = null;
    if (dragging || traveled > 8) return;
    const hit = pick(event.clientX, event.clientY);
    const id = hit?.object.userData.balloonId as string | undefined;
    if (!id) return;
    const entry = models.get(id)!;
    entry.pokeAt = elapsed;
    onClick(id, worldToStage(entry.model.group.position, state.stageSize, camera));
  }
  function onPointerLeave() { aim.set(0, 0); pointerDown = null; }
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointercancel", onPointerLeave);

  function render(now: number) {
    if (disposed) return;
    animation = requestAnimationFrame(render);
    const delta = Math.min(0.05, (now - previousTime) / 1000);
    previousTime = now;
    if (!visible || document.hidden) return;
    if (!state.paused) elapsed += delta;
    if (variant !== "recipient") {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, cameraHome.x + orbitX + (state.paused ? 0 : aim.x * 0.32), 0.035);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraHome.y + orbitY + (state.paused ? 0 : -aim.y * 0.18), 0.035);
      camera.lookAt(cameraLook);
    }
    for (const entry of models.values()) {
      if (!entry.model.group.visible) continue;
      if (entry.renderedParams !== entry.item.params && now - entry.updatedAt >= 250) {
        entry.model.updateParams(entry.item.params);
        entry.renderedParams = entry.item.params;
        entry.updatedAt = now;
      }
      const time = elapsed + entry.phase;
      entry.model.group.position.copy(entry.base);
      entry.model.group.position.y += Math.sin(time * 0.65) * 0.07;
      entry.model.group.position.x += Math.sin(time * 0.4) * 0.035;
      entry.model.group.rotation.z = Math.sin(time * 0.52) * 0.035;
      const poke = Math.max(0, 1 - (elapsed - entry.pokeAt) * 2.5);
      entry.model.update(time, state.level + Math.sin(poke * Math.PI) * 0.7);
    }
    for (let burstIndex = bursts.length - 1; burstIndex >= 0; burstIndex -= 1) {
      const burst = bursts[burstIndex];
      burst.age += delta;
      if (burst.age > 3) { scene.remove(burst.mesh); burst.mesh.dispose(); bursts.splice(burstIndex, 1); continue; }
      for (let index = 0; index < burst.velocities.length; index += 1) {
        instance.position.copy(burst.origin).addScaledVector(burst.velocities[index], burst.age);
        instance.position.y -= 0.9 * burst.age * burst.age;
        instance.rotation.set(burst.age * (index % 5 + 1), burst.age * 2.7, index + burst.age);
        instance.scale.setScalar(Math.max(0, 1 - Math.max(0, burst.age - 1.8) / 1.2));
        instance.updateMatrix();
        burst.mesh.setMatrixAt(index, instance.matrix);
      }
      burst.mesh.instanceMatrix.needsUpdate = true;
    }
    environment.update(elapsed);
    if (state.quality === "high") composer.render();
    else renderer.render(scene, camera);
  }

  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  observer?.observe(canvas);
  window.addEventListener("resize", resize);
  const intersection = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }) : null;
  intersection?.observe(canvas);
  update(initial);
  resize();
  render(performance.now());

  return {
    update,
    dispose() {
      disposed = true;
      cancelAnimationFrame(animation);
      observer?.disconnect();
      intersection?.disconnect();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointercancel", onPointerLeave);
      models.forEach((entry) => entry.model.dispose());
      bursts.forEach((burst) => burst.mesh.dispose());
      confettiGeometry.dispose();
      confettiMaterial.dispose();
      environment.dispose();
      renderPass.dispose();
      occlusion.dispose();
      depthOfField.dispose();
      bloom.dispose();
      output.dispose();
      composer.dispose();
      renderer.dispose();
    }
  };
}
