import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Wave parameters: [amplitude, wavelength, speed, steepness] + [dirX, dirZ] ──
const WAVES = [
  { A: 0.8,  L: 28.0, S: 3.2, Q: 0.45, D: [1.0, 0.6]  },
  { A: 0.5,  L: 18.0, S: 2.4, Q: 0.35, D: [-0.7, 1.0]  },
  { A: 0.35, L: 11.0, S: 1.8, Q: 0.5,  D: [0.4, -0.8]  },
  { A: 0.2,  L: 7.0,  S: 4.0, Q: 0.3,  D: [-0.5, -0.6] },
];

const SUN_DIR = new THREE.Vector3(0.5, 0.4, -0.7).normalize();
const DEEP_COLOR = new THREE.Color(0x001830);
const SHALLOW_COLOR = new THREE.Color(0x006994);

// ── Vertex Shader ───────────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
  uniform float uTime;
  // Each wave packed as vec4(A, k, omega, Q) + vec2(Dx, Dz)
  uniform vec4  uWave[4];
  uniform vec2  uWaveDir[4];

  varying vec3  vWorldPos;
  varying vec3  vNormal;
  varying float vFresnel;
  varying float vHeight;

  void main() {
    vec3 pos = position;
    vec3 tangent  = vec3(1.0, 0.0, 0.0);
    vec3 binormal = vec3(0.0, 0.0, 1.0);

    for (int i = 0; i < 4; i++) {
      float A     = uWave[i].x;
      float k     = uWave[i].y;
      float omega = uWave[i].z;
      float Q     = uWave[i].w;
      vec2  D     = uWaveDir[i];

      float phase = k * dot(D, pos.xz) - omega * uTime;
      float s = sin(phase);
      float c = cos(phase);

      // Gerstner displacement
      pos.x += Q * A * D.x * c;
      pos.z += Q * A * D.y * c;
      pos.y += A * s;

      // Analytical tangent & binormal derivatives
      float WA  = k * A;
      float QWA = Q * WA;

      tangent.x  -= QWA * D.x * D.x * s;
      tangent.y  += WA * D.x * c;
      tangent.z  -= QWA * D.x * D.y * s;

      binormal.x -= QWA * D.x * D.y * s;
      binormal.y += WA * D.y * c;
      binormal.z -= QWA * D.y * D.y * s;
    }

    vec3 N = normalize(cross(binormal, tangent));
    vNormal   = N;
    vWorldPos = pos;
    vHeight   = pos.y;

    // Fresnel (view-dependent)
    vec3 viewDir = normalize(cameraPosition - pos);
    float NdotV  = max(dot(N, viewDir), 0.0);
    vFresnel = pow(1.0 - NdotV, 3.0);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// ── Fragment Shader ─────────────────────────────────────────────────────────
const fragmentShader = /* glsl */ `
  uniform vec3  uSunDir;
  uniform vec3  uDeepColor;
  uniform vec3  uShallowColor;
  uniform float uTime;

  varying vec3  vWorldPos;
  varying vec3  vNormal;
  varying float vFresnel;
  varying float vHeight;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uSunDir);

    // Depth-based water color
    float heightFactor = smoothstep(-1.5, 1.5, vHeight);
    vec3 waterColor = mix(uDeepColor, uShallowColor, heightFactor);

    // Diffuse
    float NdotL = max(dot(N, L), 0.0);
    vec3 diffuse = waterColor * (0.4 + 0.6 * NdotL);

    // Blinn-Phong specular (sun reflection)
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 512.0);
    vec3 specular = vec3(1.0, 0.95, 0.8) * spec * 2.5;

    // Sky reflection via fresnel
    vec3 skyColor = mix(vec3(0.45, 0.55, 0.7), vec3(0.15, 0.3, 0.6), max(N.y, 0.0));
    vec3 color = mix(diffuse, skyColor, vFresnel * 0.6) + specular;

    // Foam on wave crests
    float foam = smoothstep(0.6, 1.2, vHeight);
    color = mix(color, vec3(0.9, 0.95, 1.0), foam * 0.35);

    // Subtle atmospheric fog
    float dist = length(vWorldPos - cameraPosition);
    float fog = 1.0 - exp(-dist * 0.008);
    vec3 fogColor = vec3(0.55, 0.65, 0.78);
    color = mix(color, fogColor, fog);

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Sky Shader ──────────────────────────────────────────────────────────────
const skyVertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragmentShader = /* glsl */ `
  uniform vec3 uSunDir;

  varying vec3 vDir;

  void main() {
    vec3 dir = normalize(vDir);

    // Gradient: horizon -> zenith
    float y = max(dir.y, 0.0);
    vec3 zenith  = vec3(0.10, 0.18, 0.45);
    vec3 horizon = vec3(0.55, 0.65, 0.78);
    vec3 sky = mix(horizon, zenith, pow(y, 0.6));

    // Horizon haze
    float haze = exp(-4.0 * y);
    sky = mix(sky, vec3(0.7, 0.75, 0.82), haze * 0.4);

    // Sun disc + glow
    float sunDot = max(dot(dir, uSunDir), 0.0);
    float sunDisc = smoothstep(0.9994, 0.9998, sunDot);
    float sunGlow = pow(sunDot, 64.0);
    float sunHalo = pow(sunDot, 8.0);

    sky += vec3(1.0, 0.95, 0.8) * sunDisc * 3.0;
    sky += vec3(1.0, 0.8, 0.4) * sunGlow * 0.8;
    sky += vec3(1.0, 0.7, 0.3) * sunHalo * 0.15;

    // Below horizon: darken
    float belowHorizon = smoothstep(0.0, -0.08, dir.y);
    sky = mix(sky, vec3(0.15, 0.2, 0.3), belowHorizon);

    gl_FragColor = vec4(sky, 1.0);
  }
`;

// ── Renderer ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// ── Scene & Camera ──────────────────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 12, 32);

// ── Lights ──────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x8899bb, 0.5));
const dirLight = new THREE.DirectionalLight(0xffeedd, 1.5);
dirLight.position.copy(SUN_DIR).multiplyScalar(100);
scene.add(dirLight);

// ── Sky Sphere ──────────────────────────────────────────────────────────────
const skyGeo = new THREE.SphereGeometry(800, 32, 32);
const skyMat = new THREE.ShaderMaterial({
  vertexShader: skyVertexShader,
  fragmentShader: skyFragmentShader,
  uniforms: {
    uSunDir: { value: SUN_DIR },
  },
  side: THREE.BackSide,
  depthWrite: false,
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

// ── Ocean Mesh ──────────────────────────────────────────────────────────────
// Pack wave params into uniform arrays
const waveUniforms = [];
const waveDirUniforms = [];

for (const w of WAVES) {
  const k = (2 * Math.PI) / w.L;
  const omega = Math.sqrt(9.81 * k); // dispersion relation
  waveUniforms.push(new THREE.Vector4(w.A, k, omega * w.S, w.Q));

  const len = Math.sqrt(w.D[0] ** 2 + w.D[1] ** 2);
  waveDirUniforms.push(new THREE.Vector2(w.D[0] / len, w.D[1] / len));
}

const oceanMat = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uTime:         { value: 0 },
    uWave:         { value: waveUniforms },
    uWaveDir:      { value: waveDirUniforms },
    uSunDir:       { value: SUN_DIR },
    uDeepColor:    { value: DEEP_COLOR },
    uShallowColor: { value: SHALLOW_COLOR },
  },
});

const oceanGeo = new THREE.PlaneGeometry(200, 200, 256, 256);
oceanGeo.rotateX(-Math.PI / 2);
const ocean = new THREE.Mesh(oceanGeo, oceanMat);
scene.add(ocean);

// ── Controls ────────────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 8;
controls.maxDistance = 120;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.target.set(0, 0, 0);

// ── Resize ──────────────────────────────────────────────────────────────────
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

// ── Animation Loop ──────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  oceanMat.uniforms.uTime.value = clock.getElapsedTime();
  controls.update();
  renderer.render(scene, camera);
}

animate();
