import * as THREE from 'three';

import { OrbitControls } from
  'three/addons/controls/OrbitControls.js';

import { GLTFLoader } from
  'three/addons/loaders/GLTFLoader.js';

import {
  initVowelExplorer,
  setVowelExplorerVisible
} from './vowel-explorer.js';


// ========================================
// THREE.JS SETUP
// ========================================

const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, 2)
);

renderer.setSize(
  window.innerWidth,
  window.innerHeight
);

renderer.outputColorSpace = THREE.SRGBColorSpace;

container.appendChild(renderer.domElement);


// ========================================
// CAMERA CONTROLS
// ========================================

const controls = new OrbitControls(
  camera,
  renderer.domElement
);

controls.enableDamping = true;
controls.dampingFactor = 0.07;

controls.enablePan = false;

controls.minDistance = 1;
controls.maxDistance = 500;


// ========================================
// LIGHTING
// ========================================

const ambient = new THREE.AmbientLight(
  0xffffff,
  1.8
);

scene.add(ambient);

const keyLight = new THREE.DirectionalLight(
  0xffffff,
  3
);

keyLight.position.set(100, 150, 200);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(
  0xb8d6e0,
  2
);

fillLight.position.set(-100, 50, -100);
scene.add(fillLight);


// ========================================
// LOAD VOCAL TRACT
// ========================================

const loader = new GLTFLoader();

loader.load(

  'models/vocalTract.glb',

  (gltf) => {

    const model = gltf.scene;

    scene.add(model);

    // Calculate model dimensions
    const box = new THREE.Box3().setFromObject(model);

    const center = box.getCenter(
      new THREE.Vector3()
    );

    const size = box.getSize(
      new THREE.Vector3()
    );

    // Center model
    // Center the geometry inside a parent group
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
      
    // Remove model from scene and put it inside the group
    scene.remove(model);
    modelGroup.add(model);
      
    // Scale the model first
    const maxDimension = Math.max(size.x, size.y, size.z);
    const scale = 3 / maxDimension;
      
    model.scale.setScalar(scale);
      
    // Center using the scaled coordinates
    model.position.set(
      -center.x * scale,
      -center.y * scale,
      -center.z * scale
    );

    // Set camera
    camera.position.set(4, 2, 5);

    camera.lookAt(0, 0, 0);

    controls.target.set(0, 0, 0);
    controls.update();

    console.log('Vocal tract loaded successfully');

  },

  undefined,

  (error) => {
    console.error(
      'Error loading vocal tract:',
      error
    );
  }

);


// ========================================
// CHANT PLAYBACK
// ========================================

const audio = document.getElementById('chant-audio');

document.querySelectorAll('.chant-btn').forEach(
  button => {

    button.addEventListener('click', () => {

      const src = button.dataset.src;

      if (!src) {
        console.log('Recording not connected yet');
        return;
      }

      audio.pause();

      audio.src = src;

      audio.play().catch(console.error);

    });

  }
);

document.getElementById('stop-audio')
  .addEventListener('click', () => {

    audio.pause();
    audio.currentTime = 0;

  });


// ========================================
// VOWEL EXPLORER
// ========================================

// Preserve the existing vowel explorer.

initVowelExplorer();

setVowelExplorerVisible(false);

document.getElementById('enter-vowels')
  .addEventListener('click', () => {

    audio.pause();

    setVowelExplorerVisible(true);

  });


// ========================================
// RESIZE
// ========================================

window.addEventListener('resize', () => {

  camera.aspect =
    window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

});


// ========================================
// RENDER LOOP
// ========================================

function animate() {

  requestAnimationFrame(animate);

  controls.update();

  renderer.render(scene, camera);

}

animate();