// app.js

// -----------------------------------------------------------------------------
// THEME SWITCHER LOGIC (Dark / Light Mode)
// -----------------------------------------------------------------------------
const themeToggle = document.getElementById('theme-toggle');
let isLightMode = true;

// Read cached theme preference
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark-mode');
  isLightMode = false;
} else {
  document.body.classList.remove('dark-mode');
}

themeToggle.addEventListener('click', () => {
  isLightMode = !isLightMode;
  document.body.classList.toggle('dark-mode', !isLightMode);
  localStorage.setItem('theme', isLightMode ? 'light' : 'dark');
  
  // Update WebGL theme colors
  updateThreeTheme();
});

// -----------------------------------------------------------------------------
// NAV HIGHLIGHTS & SCROLL TRIGGERS
// -----------------------------------------------------------------------------
const sections = document.querySelectorAll('section');
const navLinks = document.querySelectorAll('.nav-link');

const observerOptions = {
  root: null,
  rootMargin: '-50% 0px -50% 0px', // Trigger when section occupies center viewport
  threshold: 0
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute('id');
      navLinks.forEach(link => {
        if (link.getAttribute('href') === `#${id}`) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
      
      // Hook for skills animation
      if (id === 'skills') {
        animateSkills();
      }
    }
  });
}, observerOptions);

sections.forEach(section => observer.observe(section));

// -----------------------------------------------------------------------------
// SKILLS LOAD ANIMATIONS
// -----------------------------------------------------------------------------
let skillsAnimated = false;

function animateSkills() {
  if (skillsAnimated) return; // Only animate once on scroll down
  skillsAnimated = true;

  const skillValues = {
    autocad: '95%',
    solidworks: '90%',
    illustrator: '75%',
    canva: '80%',
    htmlcss: '70%',
    linux: '75%',
    hardware: '85%'
  };

  Object.keys(skillValues).forEach(id => {
    const fill = document.getElementById(`fill-${id}`);
    if (fill) {
      fill.style.width = skillValues[id];
    }
  });
}

// -----------------------------------------------------------------------------
// THREE.JS 3D ENGINE: V8 ENGINE CAD SECTION VIEW
// -----------------------------------------------------------------------------
let scene, camera, renderer, gridHelper;
let engineGroup;
let pistons = [];
let rods = [];
let crankshaftAssembly;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// Engine dimensions
const CRANK_RADIUS = 0.6;
const ROD_LENGTH = 1.8;
const CYLINDER_COUNT = 8;

// CAD Materials & Outline Helpers
let matSolidPiston, matLinePiston;
let matSolidRod, matLineRod;
let matSolidCrank, matLineCrank;
let matSolidBlock, matLineBlock;
let matCenterline, matDim;
let labelSprite, boreSprite;

function createCadMesh(geometry, solidMat, lineMat) {
  const group = new THREE.Group();
  
  // Solid fill
  const mesh = new THREE.Mesh(geometry, solidMat);
  group.add(mesh);
  
  // Edges outline
  const edges = new THREE.EdgesGeometry(geometry);
  const line = new THREE.LineSegments(edges, lineMat);
  group.add(line);
  
  // Save references for color updates
  group.mesh = mesh;
  group.line = line;
  
  return group;
}

function createTextSprite(text, colorStr) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = colorStr;
  ctx.font = 'bold 22px "Fira Code", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 32);
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.5, 0.75, 1);
  return sprite;
}

function updateTextSprite(sprite, text, colorStr) {
  if (!sprite || !sprite.material || !sprite.material.map) return;
  const canvas = sprite.material.map.image;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colorStr;
  ctx.font = 'bold 22px "Fira Code", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 32);
  sprite.material.map.needsUpdate = true;
}

function init3D() {
  const container = document.getElementById('canvas3d-container');
  if (!container) return;

  const width = container.clientWidth;
  const height = container.clientHeight;

  // Scene & Camera
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(isLightMode ? 0xf8fafc : 0x08090d, 0.05);

  camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(0, 4, 9);
  camera.lookAt(0, 0.2, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(isLightMode ? 0xf8fafc : 0x08090d);
  container.appendChild(renderer.domElement);

  // Ground Grid
  gridHelper = new THREE.GridHelper(20, 20, isLightMode ? 0x0284c7 : 0x00f0ff, isLightMode ? 0xcbd5e1 : 0x11131c);
  gridHelper.position.y = -2.8;
  scene.add(gridHelper);

  // Colors based on theme
  const fillCol = isLightMode ? 0xffffff : 0x11131c;
  const linePistonCol = isLightMode ? 0x0284c7 : 0x00f0ff;
  const lineCrankCol = isLightMode ? 0xea580c : 0xff5a00;
  const lineBlockCol = isLightMode ? 0x475569 : 0x94a3b8;
  const dimCol = isLightMode ? 0xea580c : 0xff5a00;
  const centerlineCol = isLightMode ? 0x94a3b8 : 0x475569;

  // Initialize CAD Materials
  matSolidPiston = new THREE.MeshBasicMaterial({ 
    color: fillCol, 
    polygonOffset: true, 
    polygonOffsetFactor: 1, 
    polygonOffsetUnits: 1 
  });
  matLinePiston = new THREE.LineBasicMaterial({ color: linePistonCol });

  matSolidRod = new THREE.MeshBasicMaterial({ 
    color: fillCol, 
    polygonOffset: true, 
    polygonOffsetFactor: 1, 
    polygonOffsetUnits: 1 
  });
  matLineRod = new THREE.LineBasicMaterial({ color: linePistonCol });

  matSolidCrank = new THREE.MeshBasicMaterial({ 
    color: fillCol, 
    polygonOffset: true, 
    polygonOffsetFactor: 1, 
    polygonOffsetUnits: 1 
  });
  matLineCrank = new THREE.LineBasicMaterial({ color: lineCrankCol });

  matSolidBlock = new THREE.MeshBasicMaterial({ 
    color: fillCol, 
    polygonOffset: true, 
    polygonOffsetFactor: 1, 
    polygonOffsetUnits: 1 
  });
  matLineBlock = new THREE.LineBasicMaterial({ color: lineBlockCol });

  matCenterline = new THREE.LineDashedMaterial({
    color: centerlineCol,
    dashSize: 0.15,
    gapSize: 0.08,
    scale: 1
  });

  matDim = new THREE.LineBasicMaterial({ color: dimCol });

  engineGroup = new THREE.Group();
  scene.add(engineGroup);

  // 1. Static V8 Engine Block: Section view (180 deg cut cylinders & bank covers)
  const beta_L = 3 * Math.PI / 4; // Left bank angle: 135 degrees
  const beta_R = Math.PI / 4;     // Right bank angle: 45 degrees

  for (let i = 0; i < CYLINDER_COUNT; i++) {
    const j = Math.floor(i / 2); // Bay index
    const isLeft = (i % 2 === 0);
    const beta = isLeft ? beta_L : beta_R;
    const zPos = -1.8 + j * 1.2 + (isLeft ? -0.15 : 0.15);

    // Section cylinder housing (180 deg thetaLength to make it cut in half)
    const cylHousingGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.8, 12, 1, true, -Math.PI / 2, Math.PI);
    const cyl = createCadMesh(cylHousingGeo, matSolidBlock, matLineBlock);
    
    cyl.position.set(Math.cos(beta) * 1.7, Math.sin(beta) * 1.7, zPos);
    cyl.rotation.z = beta - Math.PI / 2;
    
    engineGroup.add(cyl);
  }

  // Cylinder Head Valve Covers (rectangular plates cut in half or sectioned)
  const coverGeo = new THREE.BoxGeometry(0.7, 0.15, 4.4);
  
  // Left Valve Cover
  const leftCover = createCadMesh(coverGeo, matSolidBlock, matLineBlock);
  leftCover.position.set(Math.cos(beta_L) * 2.6, Math.sin(beta_L) * 2.6, 0);
  leftCover.rotation.z = beta_L - Math.PI / 2;
  engineGroup.add(leftCover);

  // Right Valve Cover
  const rightCover = createCadMesh(coverGeo, matSolidBlock, matLineBlock);
  rightCover.position.set(Math.cos(beta_R) * 2.6, Math.sin(beta_R) * 2.6, 0);
  rightCover.rotation.z = beta_R - Math.PI / 2;
  engineGroup.add(rightCover);

  // 1.5. CAD Centerlines for Cylinders
  for (let i = 0; i < CYLINDER_COUNT; i++) {
    const j = Math.floor(i / 2);
    const isLeft = (i % 2 === 0);
    const beta = isLeft ? beta_L : beta_R;
    const zPos = -1.8 + j * 1.2 + (isLeft ? -0.15 : 0.15);

    const points = [];
    points.push(new THREE.Vector3(0, 0, zPos));
    points.push(new THREE.Vector3(Math.cos(beta) * 3.0, Math.sin(beta) * 3.0, zPos));
    
    const centerlineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const centerline = new THREE.Line(centerlineGeo, matCenterline);
    centerline.computeLineDistances();
    engineGroup.add(centerline);
  }

  // 1.6. CAD Dimension Annotations
  // V-Angle Dimension Arc
  const arcCurve = new THREE.EllipseCurve(
    0, 0,             // Center
    1.2, 1.2,         // X/Y radius
    Math.PI / 4, 3 * Math.PI / 4, // Start/End angle
    false,            // Clockwise
    0                 // Rotation
  );
  const arcPoints = arcCurve.getPoints(24).map(p => new THREE.Vector3(p.x, p.y, 2.0));
  const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
  const arcLine = new THREE.Line(arcGeo, matDim);
  engineGroup.add(arcLine);

  // Dimension Extension Lines
  const extLPoints = [new THREE.Vector3(0, 0, 2.0), new THREE.Vector3(Math.cos(beta_L) * 1.3, Math.sin(beta_L) * 1.3, 2.0)];
  const extLGeo = new THREE.BufferGeometry().setFromPoints(extLPoints);
  const extLLine = new THREE.Line(extLGeo, matDim);
  engineGroup.add(extLLine);

  const extRPoints = [new THREE.Vector3(0, 0, 2.0), new THREE.Vector3(Math.cos(beta_R) * 1.3, Math.sin(beta_R) * 1.3, 2.0)];
  const extRGeo = new THREE.BufferGeometry().setFromPoints(extRPoints);
  const extRLine = new THREE.Line(extRGeo, matDim);
  engineGroup.add(extRLine);

  // Arrow Heads for V-Angle Dimension Arc
  const arrowGeo = new THREE.ConeGeometry(0.04, 0.12, 4);
  
  const arrowL = new THREE.Mesh(arrowGeo, matDim);
  arrowL.position.set(Math.cos(beta_L) * 1.2, Math.sin(beta_L) * 1.2, 2.0);
  arrowL.rotation.z = beta_L - Math.PI / 2;
  engineGroup.add(arrowL);

  const arrowR = new THREE.Mesh(arrowGeo, matDim);
  arrowR.position.set(Math.cos(beta_R) * 1.2, Math.sin(beta_R) * 1.2, 2.0);
  arrowR.rotation.z = beta_R + Math.PI / 2;
  engineGroup.add(arrowR);

  // Text sprites
  labelSprite = createTextSprite('90.0°', isLightMode ? '#ea580c' : '#ff5a00');
  labelSprite.position.set(0, 1.4, 2.0);
  engineGroup.add(labelSprite);

  boreSprite = createTextSprite('Bore: 56mm', isLightMode ? '#0284c7' : '#00f0ff');
  boreSprite.position.set(Math.cos(beta_R) * 2.5 + 0.6, Math.sin(beta_R) * 2.5 + 0.2, 0.6);
  engineGroup.add(boreSprite);

  // Bore Dimension Line
  const boreLinePoints = [
    new THREE.Vector3(Math.cos(beta_R) * 2.5, Math.sin(beta_R) * 2.5, 0.6), 
    new THREE.Vector3(Math.cos(beta_R) * 2.5 + 0.3, Math.sin(beta_R) * 2.5 + 0.1, 0.6)
  ];
  const boreLineGeo = new THREE.BufferGeometry().setFromPoints(boreLinePoints);
  const boreLine = new THREE.Line(boreLineGeo, matDim);
  engineGroup.add(boreLine);

  // 2. Rotating Crankshaft Assembly
  crankshaftAssembly = new THREE.Group();

  // Central crankshaft core shaft
  const mainShaftGeo = new THREE.CylinderGeometry(0.15, 0.15, 4.6, 12);
  const mainShaft = createCadMesh(mainShaftGeo, matSolidCrank, matLineCrank);
  mainShaft.rotation.x = Math.PI / 2;
  crankshaftAssembly.add(mainShaft);

  // Heavy Flywheel at the back
  const flywheelGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.25, 16);
  const flywheel = createCadMesh(flywheelGeo, matSolidCrank, matLineCrank);
  flywheel.position.z = -2.3;
  flywheel.rotation.x = Math.PI / 2;
  crankshaftAssembly.add(flywheel);

  // Front Pulley
  const pulleyGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.2, 12);
  const pulley = createCadMesh(pulleyGeo, matSolidCrank, matLineCrank);
  pulley.position.z = 2.3;
  pulley.rotation.x = Math.PI / 2;
  crankshaftAssembly.add(pulley);

  // Add 4 sets of Webs and Crankpins (Crossplane V8 layout)
  const webGeo = new THREE.BoxGeometry(0.18, CRANK_RADIUS + 0.15, 0.12);
  const pinGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.7, 8);
  const phases = [0, Math.PI / 2, 3 * Math.PI / 2, Math.PI];

  for (let j = 0; j < 4; j++) {
    const Z_j = -1.8 + j * 1.2;
    const phase = phases[j];

    const pinX = Math.cos(phase) * CRANK_RADIUS;
    const pinY = Math.sin(phase) * CRANK_RADIUS;

    // Web 1
    const web1 = createCadMesh(webGeo, matSolidCrank, matLineCrank);
    web1.position.set(pinX / 2, pinY / 2, Z_j - 0.35);
    web1.rotation.z = phase - Math.PI / 2;
    crankshaftAssembly.add(web1);

    // Web 2
    const web2 = createCadMesh(webGeo, matSolidCrank, matLineCrank);
    web2.position.set(pinX / 2, pinY / 2, Z_j + 0.35);
    web2.rotation.z = phase - Math.PI / 2;
    crankshaftAssembly.add(web2);

    // Crankpin
    const pin = createCadMesh(pinGeo, matSolidCrank, matLineCrank);
    pin.position.set(pinX, pinY, Z_j);
    pin.rotation.x = Math.PI / 2;
    crankshaftAssembly.add(pin);
  }

  engineGroup.add(crankshaftAssembly);

  // 3. Pistons & Connecting Rods
  // Piston geometry: 180 degree half-cylinder so we can see the internal section
  const pistonGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.4, 12, 1, false, -Math.PI / 2, Math.PI);
  // Rod geometry: Rectangular CAD outline bar
  const rodGeo = new THREE.BoxGeometry(0.08, 1.0, 0.08);

  for (let i = 0; i < CYLINDER_COUNT; i++) {
    const piston = createCadMesh(pistonGeo, matSolidPiston, matLinePiston);
    engineGroup.add(piston);
    pistons.push(piston);

    const rod = createCadMesh(rodGeo, matSolidRod, matLineRod);
    engineGroup.add(rod);
    rods.push(rod);
  }

  // Kinematic Simulation Math & Animation Loop
  let time = 0;
  function animate() {
    requestAnimationFrame(animate);

    if (!isDragging) {
      engineGroup.rotation.y += 0.004;
      time += 0.025; // Crank rotation increment
    }

    const theta = time;
    crankshaftAssembly.rotation.z = theta;

    // Update V8 cylinders kinematics
    for (let i = 0; i < CYLINDER_COUNT; i++) {
      const j = Math.floor(i / 2); // Bay index
      const isLeft = (i % 2 === 0);
      const beta = isLeft ? beta_L : beta_R;
      const zPos = -1.8 + j * 1.2 + (isLeft ? -0.15 : 0.15);

      const theta_pin = theta + phases[j];
      const delta = theta_pin - beta;

      // Distance along bank axis
      const term1 = CRANK_RADIUS * Math.cos(delta);
      const term2 = Math.sqrt(Math.max(0.1, ROD_LENGTH * ROD_LENGTH - CRANK_RADIUS * CRANK_RADIUS * Math.sin(delta) * Math.sin(delta)));
      const dist = term1 + term2;

      // Piston coordinates
      const px = Math.cos(beta) * dist;
      const py = Math.sin(beta) * dist;
      const pz = zPos;

      pistons[i].position.set(px, py, pz);
      pistons[i].rotation.z = beta - Math.PI / 2;

      // Crankpin absolute coordinates
      const cx = Math.cos(theta_pin) * CRANK_RADIUS;
      const cy = Math.sin(theta_pin) * CRANK_RADIUS;
      const cz = zPos;

      // Connecting Rod midpoint
      const rx = (cx + px) / 2;
      const ry = (cy + py) / 2;
      const rz = zPos;
      rods[i].position.set(rx, ry, rz);

      // Scale rod length dynamically
      const dx = px - cx;
      const dy = py - cy;
      const actualDist = Math.sqrt(dx * dx + dy * dy);
      rods[i].scale.set(1, actualDist, 1);

      // Orient rod
      const rodAngle = Math.atan2(dy, dx);
      rods[i].rotation.z = rodAngle - Math.PI / 2;
    }

    renderer.render(scene, camera);
  }
  animate();

  // Mouse interaction
  const canvasEl = renderer.domElement;
  canvasEl.addEventListener('mousedown', (e) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  canvasEl.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaMove = {
      x: e.clientX - previousMousePosition.x,
      y: e.clientY - previousMousePosition.y
    };
    engineGroup.rotation.y += deltaMove.x * 0.005;
    engineGroup.rotation.x += deltaMove.y * 0.005;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Zoom
  canvasEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.position.z += e.deltaY * 0.005;
    camera.position.z = Math.max(4, Math.min(camera.position.z, 15));
  });

  // Resize
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}

// Update WebGL theme colors dynamically
function updateThreeTheme() {
  if (!renderer || !scene) return;
  
  const clearColor = isLightMode ? 0xf8fafc : 0x08090d;
  renderer.setClearColor(clearColor);
  scene.fog.color.setHex(clearColor);
  
  // Rebuild grid helper
  scene.remove(gridHelper);
  gridHelper = new THREE.GridHelper(20, 20, isLightMode ? 0x0284c7 : 0x00f0ff, isLightMode ? 0xcbd5e1 : 0x11131c);
  gridHelper.position.y = -2.8;
  scene.add(gridHelper);

  // Update mechanical parts colors
  const fillCol = isLightMode ? 0xffffff : 0x11131c;
  const linePistonCol = isLightMode ? 0x0284c7 : 0x00f0ff;
  const lineCrankCol = isLightMode ? 0xea580c : 0xff5a00;
  const lineBlockCol = isLightMode ? 0x475569 : 0x94a3b8;
  const dimCol = isLightMode ? 0xea580c : 0xff5a00;
  const centerlineCol = isLightMode ? 0x94a3b8 : 0x475569;

  matSolidPiston.color.setHex(fillCol);
  matLinePiston.color.setHex(linePistonCol);

  matSolidRod.color.setHex(fillCol);
  matLineRod.color.setHex(linePistonCol);

  matSolidCrank.color.setHex(fillCol);
  matLineCrank.color.setHex(lineCrankCol);

  matSolidBlock.color.setHex(fillCol);
  matLineBlock.color.setHex(lineBlockCol);

  matCenterline.color.setHex(centerlineCol);
  matDim.color.setHex(dimCol);

  // Update canvas sprites
  updateTextSprite(labelSprite, '90.0°', isLightMode ? '#ea580c' : '#ff5a00');
  updateTextSprite(boreSprite, 'Bore: 56mm', isLightMode ? '#0284c7' : '#00f0ff');
}

// -----------------------------------------------------------------------------
// PLAYGROUND: INTERACTIVE 2D DRAFTING CANVAS
// -----------------------------------------------------------------------------
let canvas, ctx;
let activeTool = 'select'; // select, line, circle, measure
let orthoMode = false;
let points = [];
let shapes = [];
let tempGeometry = null;

function initDraftingCanvas() {
  canvas = document.getElementById('drafting-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');

  resizeDraftingCanvas();
  window.addEventListener('resize', resizeDraftingCanvas);

  // Mouse actions on 2D board
  canvas.addEventListener('mousedown', handleCanvasClick);
  canvas.addEventListener('mousemove', handleCanvasMouseMove);
  
  // Tool buttons click bindings
  setupCanvasTools();
}

function resizeDraftingCanvas() {
  if (!canvas) return;
  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight;
  redrawCanvas();
}

function setCanvasTool(toolName) {
  activeTool = toolName;
  tempGeometry = null;
  
  // Update sidebar buttons active states
  document.querySelectorAll('.sandbox-tool-btn').forEach(btn => {
    btn.classList.remove('active', 'active-orange');
    if (btn.id === `tool-${toolName}`) {
      if (toolName === 'measure') {
        btn.classList.add('active-orange');
      } else if (toolName !== 'erase' && toolName !== 'ortho') {
        btn.classList.add('active');
      }
    }
  });

  // Update status bar label
  const activeToolLabel = document.getElementById('active-tool');
  if (activeToolLabel) {
    activeToolLabel.textContent = toolName.toUpperCase();
    activeToolLabel.style.color = toolName === 'measure' ? 'var(--accent-orange)' : 'var(--accent-cyan)';
  }
}

function setupCanvasTools() {
  const tools = ['select', 'line', 'circle', 'measure'];
  tools.forEach(t => {
    const btn = document.getElementById(`tool-${t}`);
    if (btn) {
      btn.addEventListener('click', () => setCanvasTool(t));
    }
  });

  // Erase all
  const eraseBtn = document.getElementById('tool-erase');
  if (eraseBtn) {
    eraseBtn.addEventListener('click', () => {
      shapes = [];
      points = [];
      tempGeometry = null;
      redrawCanvas();
    });
  }

  // Ortho Mode toggle
  const orthoBtn = document.getElementById('tool-ortho');
  if (orthoBtn) {
    orthoBtn.addEventListener('click', () => {
      orthoMode = !orthoMode;
      orthoBtn.classList.toggle('active', orthoMode);
      document.getElementById('ortho-status').textContent = orthoMode ? 'ON' : 'OFF';
      document.getElementById('ortho-status').style.color = orthoMode ? 'var(--accent-green)' : 'var(--text-secondary)';
    });
  }
}

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;
  
  // Grid snap (nearest 10px)
  x = Math.round(x / 10) * 10;
  y = Math.round(y / 10) * 10;
  
  return { x, y };
}

function handleCanvasClick(e) {
  const pos = getCanvasCoords(e);
  
  if (activeTool === 'line') {
    if (points.length === 0) {
      points.push(pos);
      tempGeometry = { type: 'line', start: pos, end: pos };
    } else {
      let endPos = pos;
      if (orthoMode) {
        endPos = getOrthoPosition(points[0], pos);
      }
      
      const distance = calculateDistance(points[0], endPos);
      shapes.push({
        type: 'line',
        start: points[0],
        end: endPos,
        length: distance
      });
      
      points = [];
      tempGeometry = null;
    }
  } 
  else if (activeTool === 'circle') {
    if (points.length === 0) {
      points.push(pos);
      tempGeometry = { type: 'circle', center: pos, radius: 0 };
    } else {
      let endPos = pos;
      if (orthoMode) {
        endPos = getOrthoPosition(points[0], pos);
      }
      const radius = calculateDistance(points[0], endPos);
      
      shapes.push({
        type: 'circle',
        center: points[0],
        radius: radius
      });
      
      points = [];
      tempGeometry = null;
    }
  }
  else if (activeTool === 'measure') {
    if (points.length === 0) {
      points.push(pos);
      tempGeometry = { type: 'measure', start: pos, end: pos };
    } else {
      let endPos = pos;
      if (orthoMode) {
        endPos = getOrthoPosition(points[0], pos);
      }
      const dist = calculateDistance(points[0], endPos);
      
      shapes.push({
        type: 'measure',
        start: points[0],
        end: endPos,
        length: dist
      });
      
      points = [];
      tempGeometry = null;
    }
  }
  
  redrawCanvas();
}

function handleCanvasMouseMove(e) {
  const pos = getCanvasCoords(e);
  
  // Update coordinate label
  const scaledX = (pos.x * 0.25).toFixed(1);
  const scaledY = (pos.y * 0.25).toFixed(1);
  document.getElementById('active-coords').textContent = `X: ${scaledX}, Y: ${scaledY}`;
  
  if (points.length > 0 && tempGeometry) {
    let currentPos = pos;
    if (orthoMode) {
      currentPos = getOrthoPosition(points[0], pos);
    }
    
    if (tempGeometry.type === 'line' || tempGeometry.type === 'measure') {
      tempGeometry.end = currentPos;
    } else if (tempGeometry.type === 'circle') {
      tempGeometry.radius = calculateDistance(points[0], currentPos);
    }
    redrawCanvas();
  }
}

function getOrthoPosition(start, current) {
  const dx = Math.abs(current.x - start.x);
  const dy = Math.abs(current.y - start.y);
  return dx > dy ? { x: current.x, y: start.y } : { x: start.x, y: current.y };
}

function calculateDistance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy) * 0.25; // Scale to simulated mm
}

function redrawCanvas() {
  if (!ctx) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw Grid Lines
  ctx.strokeStyle = isLightMode ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 20) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  // Draw Shapes
  shapes.forEach(shape => {
    const isLightModeCol = isLightMode;
    const geomColor = isLightModeCol ? 'var(--accent-cyan)' : 'var(--accent-green)';
    const dimColor = 'var(--accent-orange)';
    
    if (shape.type === 'line') {
      drawSolidLine(shape.start, shape.end, geomColor);
      drawDimension(shape.start, shape.end, shape.length.toFixed(1) + ' mm', geomColor);
    } else if (shape.type === 'circle') {
      drawSolidCircle(shape.center, shape.radius, geomColor);
      drawRadialDimension(shape.center, shape.radius, 'R: ' + shape.radius.toFixed(1) + ' mm', geomColor);
    } else if (shape.type === 'measure') {
      drawSolidLine(shape.start, shape.end, dimColor, true);
      drawDimension(shape.start, shape.end, shape.length.toFixed(1) + ' mm', dimColor);
    }
  });

  // Anchors
  shapes.forEach(shape => {
    if (shape.type === 'line' || shape.type === 'measure') {
      drawAnchorNode(shape.start); drawAnchorNode(shape.end);
    } else if (shape.type === 'circle') {
      drawAnchorNode(shape.center);
    }
  });

  // Draw Guidelines
  if (tempGeometry) {
    const tempColor = isLightMode ? 'rgba(2, 132, 199, 0.4)' : 'rgba(0, 240, 255, 0.4)';
    const measureColor = 'rgba(255, 90, 0, 0.4)';
    
    if (tempGeometry.type === 'line') {
      drawSolidLine(tempGeometry.start, tempGeometry.end, tempColor, true);
      drawAnchorNode(tempGeometry.start);
    } else if (tempGeometry.type === 'circle') {
      drawSolidCircle(tempGeometry.center, tempGeometry.radius, tempColor, true);
      drawAnchorNode(tempGeometry.center);
    } else if (tempGeometry.type === 'measure') {
      drawSolidLine(tempGeometry.start, tempGeometry.end, measureColor, true);
      drawAnchorNode(tempGeometry.start);
    }
  }
}

function drawAnchorNode(p) {
  ctx.fillStyle = 'var(--accent-cyan)';
  ctx.strokeStyle = isLightMode ? '#fff' : '#000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(p.x - 3, p.y - 3, 6, 6);
  ctx.fill(); ctx.stroke();
}

function drawSolidLine(p1, p2, color, isDashed = false) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (isDashed) ctx.setLineDash([4, 4]);
  else ctx.setLineDash([]);
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawSolidCircle(center, radius, color, isDashed = false) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (isDashed) ctx.setLineDash([4, 4]);
  else ctx.setLineDash([]);
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawDimension(p1, p2, text, color) {
  if (p1.x === p2.x && p1.y === p2.y) return;
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.font = '9px "Fira Code", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(text, 0, -5);
  ctx.restore();
}

function drawRadialDimension(center, radius, text, color) {
  if (radius < 5) return;
  const angle = -Math.PI / 4;
  const rx = center.x + Math.cos(angle) * radius;
  const ry = center.y + Math.sin(angle) * radius;
  
  ctx.strokeStyle = isLightMode ? 'rgba(0,0,0,0.15)' : 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(center.x, center.y);
  ctx.lineTo(rx, ry);
  ctx.stroke();
  
  ctx.fillStyle = color;
  ctx.font = '9px "Fira Code", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(text, rx + 4, ry - 4);
}

// -----------------------------------------------------------------------------
// RFQ CONTACT FORM SUBMISSION
// -----------------------------------------------------------------------------
const rfqForm = document.getElementById('rfq-form');
const successMsg = document.getElementById('form-success');

if (rfqForm) {
  rfqForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const keyInput = rfqForm.querySelector('input[name="access_key"]');
    if (keyInput && keyInput.value === 'YOUR_ACCESS_KEY_HERE') {
      alert('Please configure your Web3Forms Access Key in index.html to receive actual emails.');
    }

    const formData = new FormData(rfqForm);
    const object = Object.fromEntries(formData);
    const json = JSON.stringify(object);

    const submitBtn = rfqForm.querySelector('.submit-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Transmitting... <svg class="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="10"/></svg>';

    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: json
    })
    .then(async (response) => {
      const jsonRes = await response.json();
      if (response.status === 200) {
        successMsg.style.display = 'flex';
        rfqForm.reset();
        setTimeout(() => {
          successMsg.style.display = 'none';
        }, 6000);
      } else {
        console.error(jsonRes);
        alert(jsonRes.message || 'Transmission failed.');
      }
    })
    .catch(error => {
      console.error(error);
      alert('Network error, please try again.');
    })
    .then(() => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    });
  });
}

// -----------------------------------------------------------------------------
// INITIALIZATION ON DOM LOAD
// -----------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  init3D();
  initDraftingCanvas();
  
  // Set default tool state
  setCanvasTool('select');
});
