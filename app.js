/**
 * app.js — Devotional Chanting Machine Resonator
 * 
 * Phase 1: 3D casing, orbit controls, animated Open/Close exploded view.
 * Uses Three.js r160 via importmap (unpkg CDN) — no build step required.
 * 
 * Dataset note: two anchor recordings with unambiguous 1-to-1 matching rows
 * confirmed in master_2022.07.08.csv:
 *   - F-Bud-Lockshana.wav        (Tibetan chant)
 *   - F-Chr-Anc-Adoramus.wav     (Gregorian chant)
 * Their acoustic measurements will be used in Phase 2 (formant sculptures).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { initVowelExplorer, setVowelExplorerVisible } from './vowel-explorer.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Scene setup
// ─────────────────────────────────────────────────────────────────────────────
const container = document.getElementById('canvas-container');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0e12);
scene.fog = new THREE.FogExp2(0x0d0e12, 0.055);

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.01, 100);
const DEFAULT_CAM = { x: 1.6, y: 1.4, z: 3.0 };
camera.position.set(DEFAULT_CAM.x, DEFAULT_CAM.y, DEFAULT_CAM.z);

// ─────────────────────────────────────────────────────────────────────────────
//  OrbitControls
// ─────────────────────────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 0.8;
controls.maxDistance = 10;
controls.target.set(0, 0, 0);
controls.update();

// ─────────────────────────────────────────────────────────────────────────────
//  Lighting
// ─────────────────────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xfff8ee, 2.2);
keyLight.position.set(3, 5, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 20;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xaad8e6, 0.8);
fillLight.position.set(-3, 2, -2);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xc8a96e, 0.6);
rimLight.position.set(0, -2, -3);
scene.add(rimLight);

// Ground plane reflection
const groundGeo = new THREE.PlaneGeometry(20, 20);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x0d0e12, metalness: 0.0, roughness: 1.0, transparent: true, opacity: 0.5
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.5;
ground.receiveShadow = true;
scene.add(ground);

// ─────────────────────────────────────────────────────────────────────────────
//  Shared materials
// ─────────────────────────────────────────────────────────────────────────────
// Translucent plastic shell — the main device body
const shellMat = new THREE.MeshPhysicalMaterial({
  color: 0xd6e8f0,
  metalness: 0.0,
  roughness: 0.12,
  transmission: 0.45,       // translucency
  thickness: 0.3,
  ior: 1.46,
  transparent: true,
  opacity: 0.88,
  envMapIntensity: 1.0,
  side: THREE.DoubleSide,
});

// Slightly darker back shell
const shellBackMat = shellMat.clone();
shellBackMat.color.set(0xb8cdd8);
shellBackMat.transmission = 0.3;
shellBackMat.opacity = 0.92;

// Matte inner structure
const chassisMat = new THREE.MeshStandardMaterial({
  color: 0x1a2a35, metalness: 0.1, roughness: 0.75
});

// Button material
const buttonMat = new THREE.MeshStandardMaterial({
  color: 0x2a2a2a, metalness: 0.3, roughness: 0.5
});

// Power button accent
const powerBtnMat = new THREE.MeshStandardMaterial({
  color: 0xc8a96e, metalness: 0.5, roughness: 0.3,
  emissive: 0xc8a96e, emissiveIntensity: 0.4
});

// Grille hole material (dark recess)
const grilleMat = new THREE.MeshStandardMaterial({
  color: 0x060a0e, metalness: 0.2, roughness: 0.8
});

// ─────────────────────────────────────────────────────────────────────────────
//  Helper: rounded-corner rectangle shape (for shell extrusion outline)
// ─────────────────────────────────────────────────────────────────────────────
function makeDeviceParts() {
  // Device overall dimensions (cassette-tape-sized device): 7cm × 10cm × 1.6cm scale
  const W = 1.4, H = 2.0, D = 0.32, R = 0.18; // radius of rounding

  // ── FRONT SHELL ─────────────────────────────────────────────────────────
  const frontGeo = new RoundedBoxGeometry(W, H, D, 4, R);
  const frontShell = new THREE.Mesh(frontGeo, shellMat);
  frontShell.castShadow = true;
  frontShell.position.z = D / 2;

  // ── BACK SHELL ──────────────────────────────────────────────────────────
  const backGeo = new RoundedBoxGeometry(W, H, D * 0.9, 4, R);
  const backShell = new THREE.Mesh(backGeo, shellBackMat);
  backShell.castShadow = true;
  backShell.position.z = -D / 2;

  // ── INNER CHASSIS ───────────────────────────────────────────────────────
  const chassisGeo = new RoundedBoxGeometry(W * 0.88, H * 0.9, D * 0.3, 4, R * 0.5);
  const chassis = new THREE.Mesh(chassisGeo, chassisMat);
  chassis.castShadow = true;
  // Chassis lives at z=0, slightly inside

  // ── SPEAKER GRILLE ──────────────────────────────────────────────────────
  // A grid of small cylinder holes on the front-bottom area
  const grilleGroup = new THREE.Group();
  const holeGeo = new THREE.CylinderGeometry(0.028, 0.028, D * 1.5, 8);
  holeGeo.rotateX(Math.PI / 2);

  const cols = 7, rows = 4;
  const gx = 0.08, gy = 0.07; // spacing
  const startX = -(cols - 1) * gx / 2;
  const startY = -(H / 2) + 0.28;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const hole = new THREE.Mesh(holeGeo, grilleMat);
      hole.position.set(startX + c * gx, startY + r * gy, 0);
      grilleGroup.add(hole);
    }
  }
  grilleGroup.position.z = D / 2 + 0.001;

  // ── BUTTONS ─────────────────────────────────────────────────────────────
  const btnGroup = new THREE.Group();

  // Numeric keypad — small square buttons
  const btnGeo = new THREE.BoxGeometry(0.1, 0.1, 0.045);
  const pad = [
    [-0.16, 0.42], [0, 0.42], [0.16, 0.42],  // row 1: 1 2 3
    [-0.16, 0.28], [0, 0.28], [0.16, 0.28],  // row 2: 4 5 6
    [-0.16, 0.14], [0, 0.14], [0.16, 0.14],  // row 3: 7 8 9
    [-0.16, 0.0],  [0, 0.0],  [0.16, 0.0],   // row 4: * 0 #
  ];
  pad.forEach(([bx, by]) => {
    const btn = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.1, 0.04, 2, 0.015), buttonMat);
    btn.position.set(bx, by, D / 2 + D / 2 + 0.02);
    btnGroup.add(btn);
  });

  // Power button top-right — gold accent
  const pwrBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 20), powerBtnMat);
  pwrBtn.position.set(0.5, 0.0, 0);  // on the right edge of device (side button)
  pwrBtn.rotation.z = Math.PI / 2;
  btnGroup.add(pwrBtn);

  // Thumbwheel (volume dial) on left edge
  const wheelGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 20);
  const wheel = new THREE.Mesh(wheelGeo, buttonMat);
  wheel.position.set(-0.52, 0.2, 0);
  wheel.rotation.z = Math.PI / 2;
  btnGroup.add(wheel);

  // LED indicator dot above grille
  const ledGeo = new THREE.SphereGeometry(0.025, 12, 12);
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 1.5,
    roughness: 0.1, metalness: 0.0
  });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(0.5, (H / 2) - 0.18, 0);
  btnGroup.add(led);

  // ── LANYARD HOLE top-centre ───────────────────────────────────────────
  const loopGeo = new THREE.TorusGeometry(0.06, 0.012, 8, 20);
  const loopMat = new THREE.MeshStandardMaterial({ color: 0x444450, metalness: 0.6, roughness: 0.3 });
  const lanyardLoop = new THREE.Mesh(loopGeo, loopMat);
  lanyardLoop.position.set(0, H / 2 + 0.04, 0);
  lanyardLoop.rotation.x = Math.PI / 2;

  return { frontShell, backShell, chassis, grilleGroup, btnGroup, lanyardLoop };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Build the scene graph
// ─────────────────────────────────────────────────────────────────────────────
const device = new THREE.Group();
scene.add(device);

// Slight tilt for appeal
device.rotation.x = 0.1;
device.rotation.y = -0.15;

const { frontShell, backShell, chassis, grilleGroup, btnGroup, lanyardLoop } =
  makeDeviceParts();

// Groups: front half and back half — these are what we explode apart
const frontGroup = new THREE.Group();
frontGroup.add(frontShell, grilleGroup, btnGroup);

const backGroup = new THREE.Group();
backGroup.add(backShell);

device.add(chassis, frontGroup, backGroup, lanyardLoop);

// ─────────────────────────────────────────────────────────────────────────────
//  Explode animation state
// ─────────────────────────────────────────────────────────────────────────────
const EXPLODE_MAX = 0.75; // max z-offset each half travels
let explodeTarget = 0;    // 0 = closed, 1 = fully open
let explodeCurrent = 0;

function setExplode(t) {
  const z = t * EXPLODE_MAX;
  frontGroup.position.z = z;
  backGroup.position.z = -z;
  // Also raise front group slightly (assembly feel)
  frontGroup.position.y = t * 0.08;
}

// ─────────────────────────────────────────────────────────────────────────────
//  UI wiring
// ─────────────────────────────────────────────────────────────────────────────
const toggleBtn = document.getElementById('toggle-explode-btn');
const btnText = document.getElementById('btn-text');
const stateLabel = document.getElementById('state-label');
const statusDot = document.getElementById('status-dot');
const slider = document.getElementById('explode-slider');
const sliderVal = document.getElementById('slider-val');
const resetCamBtn = document.getElementById('reset-cam-btn');
const presetBtns = document.querySelectorAll('.preset-btn');

let isOpen = false;

function updateUIState(t) {
  const pct = Math.round(t * 100);
  slider.value = t;
  sliderVal.textContent = pct + '%';

  if (t < 0.05) {
    stateLabel.textContent = 'CLOSED CASING';
    statusDot.style.background = '#4caf50';
    statusDot.style.boxShadow = '0 0 6px #4caf50';
  } else if (t > 0.95) {
    stateLabel.textContent = 'FULLY OPEN';
    statusDot.style.background = '#c8a96e';
    statusDot.style.boxShadow = '0 0 6px #c8a96e';
  } else {
    stateLabel.textContent = 'OPENING… ' + pct + '%';
    statusDot.style.background = '#8ecfd8';
    statusDot.style.boxShadow = '0 0 6px #8ecfd8';
  }
}

toggleBtn.addEventListener('click', () => {
  isOpen = !isOpen;
  explodeTarget = isOpen ? 1 : 0;
  btnText.textContent = isOpen ? 'Close Casing' : 'Open Exploded View';
});

slider.addEventListener('input', () => {
  explodeTarget = parseFloat(slider.value);
  isOpen = explodeTarget > 0.5;
  btnText.textContent = isOpen ? 'Close Casing' : 'Open Exploded View';
});

resetCamBtn.addEventListener('click', () => {
  camera.position.set(DEFAULT_CAM.x, DEFAULT_CAM.y, DEFAULT_CAM.z);
  controls.target.set(0, 0, 0);
  controls.update();
});

presetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    const dist = 3.5;
    if (view === 'front')      camera.position.set(0, 0, dist);
    else if (view === 'isometric') camera.position.set(1.8, 1.4, 2.8);
    else if (view === 'top')   camera.position.set(0, dist, 0.001);
    else if (view === 'side')  camera.position.set(dist, 0.2, 0);
    controls.target.set(0, 0, 0);
    controls.update();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Resize handling
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Render loop
// ─────────────────────────────────────────────────────────────────────────────
initVowelExplorer();
let explorerShown = false;
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  // Smooth explode interpolation
  explodeCurrent += (explodeTarget - explodeCurrent) * Math.min(1, dt * 4.5);
  setExplode(explodeCurrent);
  updateUIState(explodeCurrent);
  const showExplorer = explodeCurrent > 0.82;
  if (showExplorer !== explorerShown) { explorerShown = showExplorer; setVowelExplorerVisible(showExplorer); }

  // Gentle idle rotation when not interacting
  if (!controls.active) {
    device.rotation.y += dt * 0.08;
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();
