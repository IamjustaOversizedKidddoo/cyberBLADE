import type * as Three from "three";
import { bladeMesh, orbitNodes } from "@/lib/art/blade-geometry";

/**
 * Builds the WebGL blade inside `host` and runs it. Returns a cleanup that stops the loop and frees
 * every GPU resource. Renders only while the host is on screen and the tab is visible. Rotation follows
 * the surrounding scene's --scene-progress (plus a slow idle spin). `onLost` is called if the GPU drops
 * the context, so the caller can fall back to the drawn mark.
 */
export function mountBlade(THREE: typeof Three, host: HTMLElement, onLost: () => void): () => void {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const canvas = renderer.domElement;
  canvas.className = "absolute inset-0 h-full w-full";
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.2, 7);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(bladeMesh().positions, 3));
  geometry.computeVertexNormals();
  const body = new THREE.MeshStandardMaterial({ color: 0x0b0f19, metalness: 0.65, roughness: 0.32, flatShading: true });
  const edgesGeometry = new THREE.EdgesGeometry(geometry, 18);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x0fbeff });

  const blade = new THREE.Group();
  blade.add(new THREE.Mesh(geometry, body), new THREE.LineSegments(edgesGeometry, edgeMaterial));
  blade.rotation.z = 0.48;

  const nodeGeometry = new THREE.SphereGeometry(0.07, 12, 12);
  const pink = new THREE.MeshBasicMaterial({ color: 0xff1065 });
  const cyan = new THREE.MeshBasicMaterial({ color: 0x0fbeff });
  const orbit = new THREE.Group();
  orbitNodes(6, 1.7).forEach(([x, y, z], i) => {
    const node = new THREE.Mesh(nodeGeometry, i % 2 ? pink : cyan);
    node.position.set(x, y, z);
    orbit.add(node);
  });
  orbit.rotation.x = 0.35;

  scene.add(blade, orbit, new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xc83cff, 1.4);
  key.position.set(3, 4, 5);
  const rim = new THREE.DirectionalLight(0x0fbeff, 1.0);
  rim.position.set(-4, -2, 3);
  scene.add(key, rim);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = host;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  const sceneEl = host.closest<HTMLElement>("[data-scene]");
  let onScreen = false;
  let frame = 0;
  const clock = new THREE.Clock();
  const loop = () => {
    frame = 0;
    if (!onScreen || document.hidden) return;
    const t = clock.getElapsedTime();
    const progress = Number(sceneEl?.style.getPropertyValue("--scene-progress") || 0);
    blade.rotation.y = t * 0.25 + progress * Math.PI * 1.5;
    orbit.rotation.y = -t * 0.4 - progress * Math.PI;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  };
  const wake = () => {
    if (!frame && onScreen && !document.hidden) frame = requestAnimationFrame(loop);
  };
  const io = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    wake();
  });
  io.observe(host);
  document.addEventListener("visibilitychange", wake);

  const lost = (e: Event) => {
    e.preventDefault();
    cleanup();
    onLost();
  };
  canvas.addEventListener("webglcontextlost", lost);

  let done = false;
  function cleanup() {
    if (done) return;
    done = true;
    cancelAnimationFrame(frame);
    io.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", wake);
    canvas.removeEventListener("webglcontextlost", lost);
    for (const d of [geometry, edgesGeometry, nodeGeometry, body, edgeMaterial, pink, cyan]) d.dispose();
    renderer.dispose();
    canvas.remove();
  }
  return cleanup;
}
