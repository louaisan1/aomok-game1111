import * as THREE from 'three';

// Build textures procedurally so we don't need any external image assets.

function makeCanvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

export function createWoodTexture(opts = {}) {
  const { color1 = '#5a3a22', color2 = '#3a2412', planks = 4, tone = 0 } = opts;
  const c = makeCanvas(512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, c.width, c.height);
  // Plank stripes
  const ph = c.height / planks;
  for (let i = 0; i < planks; i++) {
    const y = i * ph;
    const grad = ctx.createLinearGradient(0, y, 0, y + ph);
    grad.addColorStop(0, color1);
    grad.addColorStop(0.5, color2);
    grad.addColorStop(1, color1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, c.width, ph);
    // grain
    for (let g = 0; g < 16; g++) {
      ctx.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.07})`;
      ctx.lineWidth = 1 + Math.random() * 1.4;
      ctx.beginPath();
      const yy = y + Math.random() * ph;
      ctx.moveTo(0, yy);
      ctx.bezierCurveTo(
        c.width * 0.33, yy + (Math.random() - 0.5) * 12,
        c.width * 0.66, yy + (Math.random() - 0.5) * 12,
        c.width, yy
      );
      ctx.stroke();
    }
    // plank gap
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(c.width, y);
    ctx.stroke();
  }
  // Slight color tint
  if (tone) {
    ctx.fillStyle = `rgba(0,0,0,${tone})`;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createStoneTexture() {
  const c = makeCanvas(512);
  const ctx = c.getContext('2d');
  // Base
  ctx.fillStyle = '#444856';
  ctx.fillRect(0, 0, c.width, c.height);
  // Noise blobs
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const r = 1 + Math.random() * 3;
    const v = Math.floor(40 + Math.random() * 60);
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 12},${0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Brick lines
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  const rows = 6;
  const cols = 4;
  const rh = c.height / rows;
  const cw = c.width / cols;
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(c.width, y);
    ctx.stroke();
    const offset = (r % 2) * cw / 2;
    for (let cI = 0; cI < cols; cI++) {
      const x = cI * cw + offset;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + rh);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCeilingTexture() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1d28';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const v = 12 + Math.random() * 28;
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 12},0.6)`;
    ctx.fillRect(x, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A label canvas texture with a centered token character
export function createTokenTexture(token, color = '#ffffff', bg = '#101018') {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  // border
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, size - 16, size - 16);
  // glow
  ctx.shadowColor = color;
  ctx.shadowBlur = 28;
  ctx.fillStyle = color;
  ctx.font = 'bold 170px "Tajawal", "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const display = token === '*' ? '×' : token === '/' ? '÷' : token;
  ctx.fillText(display, size / 2, size / 2 + 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCardTexture() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  // Card background
  const grd = ctx.createLinearGradient(0, 0, size, size);
  grd.addColorStop(0, '#fff8e6');
  grd.addColorStop(1, '#ffe7a3');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  // Border
  ctx.strokeStyle = '#7a4f1c';
  ctx.lineWidth = 12;
  ctx.strokeRect(20, 20, size - 40, size - 40);
  // Decoration
  ctx.fillStyle = '#a26a23';
  ctx.font = '600 36px "Tajawal", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('بطاقة الحل', size / 2, 90);
  // Big = 7
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 220px "Tajawal", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('= 7', size / 2, size / 2 + 20);

  ctx.fillStyle = '#7a4f1c';
  ctx.font = '500 26px "Tajawal", system-ui, sans-serif';
  ctx.fillText('شكّل معادلتك من الأبواب لتساوي ٧', size / 2, size - 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createTilesTexture() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#26313f';
  ctx.fillRect(0, 0, size, size);
  const tile = 64;
  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      const tone = 30 + Math.random() * 35;
      ctx.fillStyle = `rgb(${tone | 0},${(tone + 8) | 0},${(tone + 24) | 0})`;
      ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
