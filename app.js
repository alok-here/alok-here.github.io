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
// THREE.JS 3D ENGINE: 8-CYLINDER RADIAL ENGINE
// -----------------------------------------------------------------------------
let scene, camera, renderer, gridHelper;
let engineGroup;
let pistons = [];
let rods = [];
let crankpinMesh;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// Engine dimensions
const CRANK_RADIUS = 0.9;
const ROD_LENGTH = 2.4;
const CYLINDER_COUNT = 8;

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

  // Materials (Cyan and Orange wireframes)
  const matCyan = new THREE.MeshBasicMaterial({ 
    color: isLightMode ? 0x0284c7 : 0x00f0ff, 
    wireframe: true, 
    transparent: true, 
    opacity: 0.75 
  });
  const matOrange = new THREE.MeshBasicMaterial({ 
    color: isLightMode ? 0xea580c : 0xff5a00, 
    wireframe: true, 
    transparent: true, 
    opacity: 0.85 
  });
  const matGrey = new THREE.MeshBasicMaterial({ 
    color: 0x64748b, 
    wireframe: true, 
    transparent: true, 
    opacity: 0.4 
  });

  engineGroup = new THREE.Group();
  scene.add(engineGroup);

  // 1. Static Cylinders (8 housings pointing outward)
  for (let i = 0; i < CYLINDER_COUNT; i++) {
    const angle = (i / CYLINDER_COUNT) * Math.PI * 2;
    
    // Cylinder housing mesh
    const cylHousingGeo = new THREE.CylinderGeometry(0.38, 0.38, 1.6, 8, 2, true);
    const cyl = new THREE.Mesh(cylHousingGeo, matGrey);
    
    // Position outer cylinders radial to center
    cyl.position.x = Math.cos(angle) * 2.8;
    cyl.position.y = Math.sin(angle) * 2.8;
    cyl.rotation.z = angle - Math.PI / 2; // Point outwards
    
    engineGroup.add(cyl);
  }

  // 2. Crankshaft Center Pin & Crank Arm
  const crankGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.4, 8);
  const crankCenter = new THREE.Mesh(crankGeo, matOrange);
  crankCenter.rotation.x = Math.PI / 2;
  engineGroup.add(crankCenter);

  // Crank Arm (connecting center pin to crankpin)
  const armGeo = new THREE.BoxGeometry(0.25, CRANK_RADIUS, 0.15);
  const crankArm = new THREE.Mesh(armGeo, matOrange);
  crankArm.position.y = CRANK_RADIUS / 2;
  
  // Rotating crankshaft group
  const crankshaftAssembly = new THREE.Group();
  crankshaftAssembly.add(crankArm);

  // Crankpin
  const pinGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8);
  crankpinMesh = new THREE.Mesh(pinGeo, matOrange);
  crankpinMesh.position.y = CRANK_RADIUS;
  crankpinMesh.rotation.x = Math.PI / 2;
  crankshaftAssembly.add(crankpinMesh);

  engineGroup.add(crankshaftAssembly);

  // 3. Pistons & Connecting Rods
  for (let i = 0; i < CYLINDER_COUNT; i++) {
    // Piston
    const pistonGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.5, 8);
    const piston = new THREE.Mesh(pistonGeo, matCyan);
    engineGroup.add(piston);
    pistons.push(piston);

    // Rod (represented by lines / boxes)
    const rodGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6);
    const rod = new THREE.Mesh(rodGeo, matCyan);
    engineGroup.add(rod);
    rods.push(rod);
  }

  // Kinematic Simulation Math & Animation Loop
  let time = 0;
  function animate() {
    requestAnimationFrame(animate);

    if (!isDragging) {
      engineGroup.rotation.y += 0.004;
      time += 0.025; // Crankshaft rotation increment
    }

    // Crank rotation angle
    const theta = time;
    crankshaftAssembly.rotation.z = theta;

    // Position of crankpin in global space of engineGroup
    const pinX = Math.cos(theta) * CRANK_RADIUS;
    const pinY = Math.sin(theta) * CRANK_RADIUS;

    // Update pistons & rods
    for (let i = 0; i < CYLINDER_COUNT; i++) {
      const phi = (i / CYLINDER_COUNT) * Math.PI * 2; // Cylinder axis angle

      // Sliding piston formula: distance from crankshaft center along cylinder axis (phi)
      // d = R*cos(theta - phi) + sqrt(L^2 - R^2 * sin^2(theta - phi))
      const deltaAngle = theta - phi;
      const term1 = CRANK_RADIUS * Math.cos(deltaAngle);
      const term2 = Math.sqrt(Math.max(0.1, ROD_LENGTH * ROD_LENGTH - CRANK_RADIUS * CRANK_RADIUS * Math.sin(deltaAngle) * Math.sin(deltaAngle)));
      const dist = term1 + term2;

      // Piston coordinates
      const px = Math.cos(phi) * dist;
      const py = Math.sin(phi) * dist;

      // Position & Orient piston
      pistons[i].position.set(px, py, 0);
      pistons[i].rotation.z = phi - Math.PI / 2;

      // Connecting Rod position (between crankpin and piston pin)
      // Rod center is midpoint
      const rx = (pinX + px) / 2;
      const ry = (pinY + py) / 2;
      rods[i].position.set(rx, ry, 0);

      // Rod length (should match actual distance between crankpin and piston center)
      const dx = px - pinX;
      const dy = py - pinY;
      const actualDist = Math.sqrt(dx * dx + dy * dy);
      rods[i].scale.set(1, actualDist, 1);

      // Orient rod to look at piston position from crankpin position
      const rodAngle = Math.atan2(dy, dx);
      rods[i].rotation.z = rodAngle - Math.PI / 2;
    }

    renderer.render(scene, camera);
  }
  animate();

  // Mouse interaction to rotate view
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
  const matColorCyan = isLightMode ? 0x0284c7 : 0x00f0ff;
  const matColorOrange = isLightMode ? 0xea580c : 0xff5a00;

  pistons.forEach(p => {
    p.material.color.setHex(matColorCyan);
  });
  rods.forEach(r => {
    r.material.color.setHex(matColorCyan);
  });
  crankpinMesh.material.color.setHex(matColorOrange);
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
