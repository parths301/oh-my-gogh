/**
 * Oh my Gogh! — ASCII Art Engine (Variation 1)
 * Full-screen procedural paintings rendered as colored ASCII characters
 * with mouse-reactive physics and smooth transitions.
 */

// ============================================================
// NOISE — compact value noise for procedural generation
// ============================================================
const _p = new Uint8Array(512);
(function initNoise() {
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 512; i++) _p[i] = perm[i & 255];
})();

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }

function grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function noise3D(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = _p[X] + Y, AA = _p[A] + Z, AB = _p[A + 1] + Z;
    const B = _p[X + 1] + Y, BA = _p[B] + Z, BB = _p[B + 1] + Z;
    return lerp(
        lerp(lerp(grad(_p[AA], x, y, z), grad(_p[BA], x - 1, y, z), u),
             lerp(grad(_p[AB], x, y - 1, z), grad(_p[BB], x - 1, y - 1, z), u), v),
        lerp(lerp(grad(_p[AA + 1], x, y, z - 1), grad(_p[BA + 1], x - 1, y, z - 1), u),
             lerp(grad(_p[AB + 1], x, y - 1, z - 1), grad(_p[BB + 1], x - 1, y - 1, z - 1), u), v),
        w
    );
}

function fbm(x, y, z, octaves = 4) {
    let val = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
        val += amp * noise3D(x * freq, y * freq, z * freq);
        amp *= 0.5; freq *= 2;
    }
    return val;
}

// ============================================================
// COLOR UTILITIES
// ============================================================
function clamp(v, min = 0, max = 255) { return v < min ? min : v > max ? max : v; }

function lerpColor(c1, c2, t) {
    return {
        r: clamp(Math.round(lerp(c1.r, c2.r, t))),
        g: clamp(Math.round(lerp(c1.g, c2.g, t))),
        b: clamp(Math.round(lerp(c1.b, c2.b, t)))
    };
}

function brightness(c) {
    return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
}

// ============================================================
// PAINTING GENERATORS
// Each returns { r, g, b } for normalized coords (nx, ny) ∈ [0,1]
// ============================================================
const PAINTINGS = [
    // 0 — Starry Night
    function starryNight(nx, ny, t) {
        const swirl = fbm(
            nx * 3 + Math.sin(ny * 2.5 + t * 0.6) * 0.8,
            ny * 2.5 + Math.cos(nx * 2 + t * 0.4) * 0.6,
            t * 0.25, 5
        );
        const s2 = fbm(nx * 6 + t * 0.1, ny * 5, t * 0.15, 3);
        const starField = noise3D(nx * 30, ny * 25, t * 0.08);
        const isStar = starField > 0.62;

        if (isStar) {
            const tw = 0.6 + 0.4 * Math.sin(t * 4 + nx * 80 + ny * 60);
            return { r: clamp(255 * tw), g: clamp(215 * tw), b: clamp(40 * tw) };
        }

        const sn = (swirl + 1) * 0.5;
        const village = ny > 0.75 ? Math.max(0, (ny - 0.75) * 4) : 0;
        return {
            r: clamp(12 + sn * 35 + s2 * 20 - village * 10),
            g: clamp(15 + sn * 55 + s2 * 30 - village * 15),
            b: clamp(60 + sn * 140 + s2 * 50 - village * 30)
        };
    },

    // 1 — The Great Wave
    function greatWave(nx, ny, t) {
        const waveBase = Math.sin(nx * 10 - t * 1.8 + Math.sin(ny * 4 + t * 0.5) * 2.5);
        const wave2 = Math.sin(nx * 14 - t * 2.5 + Math.cos(ny * 6) * 1.5) * 0.6;
        const wave3 = Math.sin(nx * 7 - t * 1.2 + ny * 5) * 0.4;
        const n = fbm(nx * 4 + t * 0.3, ny * 3, t * 0.2, 3);
        const combined = (waveBase + wave2 + wave3) / 3 * 0.5 + 0.5;
        const crest = Math.max(0, combined - 0.6) / 0.4;
        const foam = crest * crest;
        const depth = 1 - ny;

        return {
            r: clamp(5 + foam * 220 + n * 15),
            g: clamp(30 + combined * 60 + foam * 180 + depth * 30),
            b: clamp(80 + combined * 100 + foam * 60 + depth * 60 + n * 30)
        };
    },

    // 2 — Sunflowers / Warm Impressionism
    function sunflowers(nx, ny, t) {
        const centers = [
            [0.3, 0.35], [0.5, 0.25], [0.7, 0.4], [0.35, 0.65], [0.65, 0.6],
            [0.5, 0.5], [0.2, 0.5], [0.8, 0.3]
        ];
        let flower = 0;
        for (const [cx, cy] of centers) {
            const d = Math.sqrt((nx - cx) ** 2 + (ny - cy) ** 2);
            const angle = Math.atan2(ny - cy, nx - cx);
            const petals = Math.sin(angle * 7 + t * 0.8) * 0.5 + 0.5;
            const ring = Math.sin(d * 40 - t * 2) * 0.5 + 0.5;
            if (d < 0.18) {
                flower = Math.max(flower, (1 - d / 0.18) * (0.5 + petals * 0.5));
            }
        }
        const n = fbm(nx * 5, ny * 5, t * 0.15, 3);
        const bg = 0.2 + n * 0.3;

        return {
            r: clamp(80 + flower * 175 + bg * 60 + n * 30),
            g: clamp(50 + flower * 130 + bg * 40 - ny * 20),
            b: clamp(15 + flower * 20 + bg * 15 + n * 10)
        };
    },

    // 3 — Kandinsky / Bold Abstract
    function abstractKandinsky(nx, ny, t) {
        const dist = Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2);
        const angle = Math.atan2(ny - 0.5, nx - 0.5);
        const rings = Math.sin(dist * 20 - t * 2) * 0.5 + 0.5;
        const spiral = Math.sin(angle * 3 + dist * 15 - t * 1.5) * 0.5 + 0.5;
        const n = fbm(nx * 3 + t * 0.2, ny * 3, t * 0.3, 3);

        const palettes = [
            { r: 200, g: 40, b: 40 },
            { r: 30, g: 100, b: 200 },
            { r: 240, g: 190, b: 30 },
            { r: 180, g: 50, b: 160 },
            { r: 40, g: 170, b: 100 },
            { r: 230, g: 100, b: 30 }
        ];

        const idx = Math.floor(((angle + Math.PI + t * 0.2) / (Math.PI * 2)) * palettes.length) % palettes.length;
        const nextIdx = (idx + 1) % palettes.length;
        const frac = (((angle + Math.PI + t * 0.2) / (Math.PI * 2)) * palettes.length) % 1;
        const c = lerpColor(palettes[idx], palettes[nextIdx], frac);
        const factor = 0.35 + rings * 0.35 + spiral * 0.2 + n * 0.15;

        return {
            r: clamp(c.r * factor),
            g: clamp(c.g * factor),
            b: clamp(c.b * factor)
        };
    },

    // 5 — Rothko Color Fields
    function rothko(nx, ny, t) {
        const n = fbm(nx * 2, ny * 8, t * 0.1, 3);
        const band = ny + n * 0.08;
        const soft = fbm(nx * 5, ny * 5, t * 0.15, 2) * 0.15;
        if (band < 0.3) {
            return { r: clamp(140 + soft * 200), g: clamp(25 + soft * 100), b: clamp(30 + soft * 80) };
        } else if (band < 0.35) {
            return { r: clamp(15), g: clamp(12), b: clamp(10) };
        } else if (band < 0.65) {
            return { r: clamp(180 + soft * 150), g: clamp(80 + soft * 120), b: clamp(20 + soft * 60) };
        } else if (band < 0.7) {
            return { r: clamp(15), g: clamp(12), b: clamp(10) };
        } else {
            return { r: clamp(120 + soft * 180), g: clamp(20 + soft * 80), b: clamp(40 + soft * 100) };
        }
    },

    // 6 — Impression Sunrise
    function impressionSunrise(nx, ny, t) {
        const horizon = 0.55;
        const n = fbm(nx * 3 + t * 0.2, ny * 2, t * 0.12, 4);
        const sunX = 0.45 + Math.sin(t * 0.1) * 0.05;
        const sunY = 0.38;
        const sunDist = Math.sqrt((nx - sunX) ** 2 + ((ny - sunY) * 1.5) ** 2);
        const sunGlow = Math.max(0, 1 - sunDist / 0.25);
        const sunCore = Math.max(0, 1 - sunDist / 0.06);

        if (ny < horizon) {
            const skyGrad = ny / horizon;
            return {
                r: clamp(30 + skyGrad * 80 + sunGlow * 200 + sunCore * 80 + n * 20),
                g: clamp(20 + skyGrad * 50 + sunGlow * 100 + sunCore * 40 + n * 15),
                b: clamp(60 + skyGrad * 40 - sunGlow * 30 + n * 25)
            };
        }
        const reflection = Math.sin(nx * 25 + t * 2 + n * 5) * 0.3;
        const waterY = (ny - horizon) / (1 - horizon);
        const sunReflect = Math.max(0, 1 - Math.abs(nx - sunX) / (0.06 + waterY * 0.15)) * Math.max(0, 1 - waterY * 1.5);
        return {
            r: clamp(15 + waterY * 25 + sunReflect * 180 + reflection * 20 + n * 15),
            g: clamp(25 + waterY * 20 + sunReflect * 80 + n * 15),
            b: clamp(50 + waterY * 30 + reflection * 15 + n * 20)
        };
    },

    // 7 — Pollock Drip Abstract
    function pollock(nx, ny, t) {
        let r = 20, g = 18, b = 15;
        const layers = [
            { color: { r: 10, g: 10, b: 10 }, freq: 3, thresh: 0.12 },
            { color: { r: 200, g: 190, b: 170 }, freq: 5, thresh: 0.08 },
            { color: { r: 180, g: 40, b: 30 }, freq: 7, thresh: 0.06 },
            { color: { r: 30, g: 60, b: 160 }, freq: 9, thresh: 0.05 },
            { color: { r: 220, g: 200, b: 50 }, freq: 11, thresh: 0.04 }
        ];
        for (const layer of layers) {
            const drip = fbm(nx * layer.freq + t * 0.05, ny * layer.freq * 2.5 + t * 0.08, t * 0.1 + layer.freq, 4);
            const splat = Math.abs(drip);
            if (splat < layer.thresh) {
                const intensity = 1 - splat / layer.thresh;
                r = lerp(r, layer.color.r, intensity * 0.9);
                g = lerp(g, layer.color.g, intensity * 0.9);
                b = lerp(b, layer.color.b, intensity * 0.9);
            }
        }
        return { r: clamp(r), g: clamp(g), b: clamp(b) };
    },

    // 8 — Cherry Blossoms
    function cherryBlossoms(nx, ny, t) {
        const n = fbm(nx * 3, ny * 3, t * 0.1, 3);
        const skyR = lerp(140, 200, ny) + n * 20;
        const skyG = lerp(160, 210, ny) + n * 15;
        const skyB = lerp(200, 240, ny) + n * 10;

        const branchY = 0.35 + Math.sin(nx * 6 + 1.5) * 0.08 + Math.sin(nx * 12) * 0.03;
        const onBranch = Math.abs(ny - branchY) < 0.008 && nx > 0.1;
        const branch2Y = 0.5 + Math.sin(nx * 4 + 3) * 0.1;
        const onBranch2 = Math.abs(ny - branch2Y) < 0.006 && nx > 0.3;
        if (onBranch || onBranch2) return { r: clamp(60), g: clamp(35), b: clamp(25) };

        const blossoms = [
            [0.25, 0.32], [0.4, 0.28], [0.55, 0.38], [0.7, 0.33], [0.35, 0.48],
            [0.5, 0.52], [0.65, 0.45], [0.8, 0.37], [0.45, 0.3], [0.6, 0.55],
            [0.3, 0.55], [0.75, 0.5], [0.2, 0.4], [0.55, 0.25], [0.85, 0.42]
        ];
        for (const [bx, by] of blossoms) {
            const d = Math.sqrt((nx - bx) ** 2 + (ny - by) ** 2);
            if (d < 0.05) {
                const petal = Math.sin(Math.atan2(ny - by, nx - bx) * 5 + t) * 0.3 + 0.7;
                const fall = 1 - d / 0.05;
                return {
                    r: clamp(220 + petal * 35),
                    g: clamp(140 + petal * 40 + fall * 30),
                    b: clamp(160 + petal * 50 + fall * 20)
                };
            }
        }

        const fallingPetal = noise3D(nx * 8 + t * 0.5, ny * 6 - t * 0.8, t * 0.3);
        if (fallingPetal > 0.72) {
            return { r: clamp(240), g: clamp(180), b: clamp(190) };
        }
        return { r: clamp(skyR), g: clamp(skyG), b: clamp(skyB) };
    },

    // 9 — Klimt Gold
    function klimtGold(nx, ny, t) {
        const n = fbm(nx * 4, ny * 4, t * 0.15, 4);
        const mosaic = noise3D(nx * 15, ny * 15, t * 0.05);
        const spiral = Math.sin(Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 25 - t * 1.5 + Math.atan2(ny - 0.5, nx - 0.5) * 3);
        const golden = 0.4 + n * 0.3 + spiral * 0.15 + mosaic * 0.15;

        const figureX = 0.45, figureY = 0.5;
        const figDist = Math.sqrt(((nx - figureX) * 0.8) ** 2 + ((ny - figureY) * 1.2) ** 2);
        const inFigure = figDist < 0.25;

        if (inFigure) {
            const pattern = Math.sin(nx * 30 + ny * 30 + t) * 0.5 + 0.5;
            const geo = Math.floor(mosaic * 4) / 4;
            return {
                r: clamp(180 + golden * 75 + pattern * 30),
                g: clamp(140 + golden * 60 + geo * 25),
                b: clamp(30 + golden * 20 + pattern * 15)
            };
        }

        const tile = (Math.floor(nx * 20) + Math.floor(ny * 20)) % 3;
        const tileBoost = tile === 0 ? 0.2 : tile === 1 ? -0.1 : 0;
        return {
            r: clamp(160 + golden * 95 + tileBoost * 60),
            g: clamp(120 + golden * 75 + tileBoost * 40),
            b: clamp(20 + golden * 30 + tileBoost * 15)
        };
    }
];

// ============================================================
// ASCII ENGINE
// ============================================================
const ASCII_RAMP = ' .·:;+=*%#@█';
const CELL_W = 10;
const CELL_H = 16;
const TRANSITION_DURATION = 2500; // ms
const PAINTING_HOLD = 5000; // ms between transitions

class AsciiEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.cols = 0;
        this.rows = 0;
        this.mouse = { x: -9999, y: -9999 };
        this.currentPainting = 0;
        this.nextPainting = -1;
        this.transitionProgress = 0;
        this.transitionStart = 0;
        this.lastSwitch = performance.now();
        this.time = 0;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);

        // Interactive Settings State
        this.physicsMode = 'vortex';
        this.glowStyle = 'moon';
        this.interactionRadius = 250;
        this.glowRadius = 250;

        this._onResize = this.resize.bind(this);
        this._onMouse = this.onMouse.bind(this);
        this._onTouch = this.onTouch.bind(this);

        window.addEventListener('resize', this._onResize);
        window.addEventListener('mousemove', this._onMouse);
        window.addEventListener('touchmove', this._onTouch, { passive: true });

        // Allow manual dot clicks
        document.querySelectorAll('.indicator-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                const idx = parseInt(dot.dataset.index);
                if (idx !== this.currentPainting && this.nextPainting === -1) {
                    this.goTo(idx);
                }
            });
        });

        // Side arrow buttons
        document.getElementById('navLeft').addEventListener('click', () => this.goPrev());
        document.getElementById('navRight').addEventListener('click', () => this.goNext());

        // Keyboard navigation
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.goPrev();
            else if (e.key === 'ArrowRight') this.goNext();
        });

        // Settings Panel Logic
        const toggleBtn = document.getElementById('settingsToggle');
        const panel = document.getElementById('settingsPanel');
        if (toggleBtn && panel) {
            toggleBtn.addEventListener('click', () => {
                panel.classList.toggle('collapsed');
            });
        }

        // Settings Inputs
        document.getElementById('physicsMode')?.addEventListener('change', (e) => this.physicsMode = e.target.value);
        document.getElementById('glowStyle')?.addEventListener('change', (e) => this.glowStyle = e.target.value);
        document.getElementById('interactionRadius')?.addEventListener('input', (e) => this.interactionRadius = parseInt(e.target.value));
        document.getElementById('glowRadius')?.addEventListener('input', (e) => this.glowRadius = parseInt(e.target.value));

        // Set initial counter
        this.updateCounter(0);

        this.resize();
        this.loop();
    }

    goNext() {
        if (this.nextPainting !== -1) return;
        const next = (this.currentPainting + 1) % PAINTINGS.length;
        this.goTo(next);
    }

    goPrev() {
        if (this.nextPainting !== -1) return;
        const prev = (this.currentPainting - 1 + PAINTINGS.length) % PAINTINGS.length;
        this.goTo(prev);
    }

    goTo(idx) {
        this.startTransition(idx);
        this.lastSwitch = performance.now(); // reset auto-timer
        this.updateCounter(idx);
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.canvas.width = w * this.dpr;
        this.canvas.height = h * this.dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.scale(this.dpr, this.dpr);
        this.width = w;
        this.height = h;
        this.cols = Math.ceil(w / CELL_W) + 1;
        this.rows = Math.ceil(h / CELL_H) + 1;
        this.buildParticles();
    }

    buildParticles() {
        this.particles = [];
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                this.particles.push({
                    ox: col * CELL_W,
                    oy: row * CELL_H,
                    x: col * CELL_W,
                    y: row * CELL_H,
                    vx: 0,
                    vy: 0,
                    char: ' ',
                    color: 'rgba(0,0,0,0)',
                    // for dissolve transition
                    seed: Math.random()
                });
            }
        }
    }

    onMouse(e) {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
    }

    onTouch(e) {
        if (e.touches.length > 0) {
            this.mouse.x = e.touches[0].clientX;
            this.mouse.y = e.touches[0].clientY;
        }
    }

    startTransition(nextIdx) {
        this.nextPainting = nextIdx;
        this.transitionStart = performance.now();
        this.transitionProgress = 0;
    }

    updateIndicator(idx) {
        document.querySelectorAll('.indicator-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === idx);
        });
    }

    updateCounter(idx) {
        const current = document.getElementById('counterCurrent');
        const total = document.getElementById('counterTotal');
        if (current) current.textContent = String(idx + 1).padStart(2, '0');
        if (total) total.textContent = String(PAINTINGS.length).padStart(2, '0');
    }

    loop() {
        const now = performance.now();
        this.time = now * 0.001;

        // Auto-transition
        if (this.nextPainting === -1 && now - this.lastSwitch > PAINTING_HOLD) {
            const next = (this.currentPainting + 1) % PAINTINGS.length;
            this.startTransition(next);
            this.updateCounter(next);
        }

        // Handle transition progress
        if (this.nextPainting !== -1) {
            this.transitionProgress = Math.min(1, (now - this.transitionStart) / TRANSITION_DURATION);
            if (this.transitionProgress >= 1) {
                this.currentPainting = this.nextPainting;
                this.nextPainting = -1;
                this.transitionProgress = 0;
                this.lastSwitch = now;
                this.updateIndicator(this.currentPainting);
                this.updateCounter(this.currentPainting);
            }
        }

        this.update();
        this.render();
        requestAnimationFrame(() => this.loop());
    }

    update() {
        const mx = this.mouse.x;
        const my = this.mouse.y;
        const t = this.time;

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const nx = p.ox / this.width;
            const ny = p.oy / this.height;

            // Get color from current painting
            let color = PAINTINGS[this.currentPainting](nx, ny, t);

            // Blend with next painting during transition
            if (this.nextPainting !== -1) {
                const nextColor = PAINTINGS[this.nextPainting](nx, ny, t);
                // Dissolve: each particle transitions at its own time
                const particleT = Math.max(0, Math.min(1,
                    (this.transitionProgress - p.seed * 0.4) / 0.6
                ));
                const eased = particleT * particleT * (3 - 2 * particleT);
                color = lerpColor(color, nextColor, eased);
            }

            // Map brightness to ASCII character
            const b = brightness(color);
            const charIdx = Math.floor(b * (ASCII_RAMP.length - 1));
            p.char = ASCII_RAMP[charIdx];
            p.color = `rgb(${color.r},${color.g},${color.b})`;

            // Mouse physics
            const dx = p.x - mx;
            const dy = p.y - my;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < this.interactionRadius && dist > 0) {
                const force = ((this.interactionRadius - dist) / this.interactionRadius);
                const forceSq = force * force;
                
                switch (this.physicsMode) {
                    case 'repel':
                        p.vx += (dx / dist) * forceSq * 4;
                        p.vy += (dy / dist) * forceSq * 4;
                        break;
                    case 'attract':
                        p.vx -= (dx / dist) * forceSq * 4;
                        p.vy -= (dy / dist) * forceSq * 4;
                        break;
                    case 'vortex':
                        p.vx += (dy / dist) * forceSq * 15;
                        p.vy -= (dx / dist) * forceSq * 15;
                        p.vx -= (dx / dist) * forceSq * 2;
                        p.vy -= (dy / dist) * forceSq * 2;
                        break;
                    case 'orbit':
                        p.vx += (dy / dist) * forceSq * 10;
                        p.vy -= (dx / dist) * forceSq * 10;
                        break;
                }
            }

            // Spring back
            p.vx += (p.ox - p.x) * 0.06;
            p.vy += (p.oy - p.y) * 0.06;

            // Damping
            p.vx *= 0.85;
            p.vy *= 0.85;

            p.x += p.vx;
            p.y += p.vy;
        }
    }

    render() {
        const ctx = this.ctx;
        ctx.save();
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        // Clear
        ctx.fillStyle = '#06060C';
        ctx.fillRect(0, 0, this.width, this.height);

        // Draw ASCII characters
        ctx.font = `${CELL_H - 2}px "Courier New", Courier, monospace`;
        ctx.textBaseline = 'top';

        // Batch by color for performance
        let lastColor = '';
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (p.char === ' ') continue;

            if (p.color !== lastColor) {
                ctx.fillStyle = p.color;
                lastColor = p.color;
            }
            ctx.fillText(p.char, p.x, p.y);
        }

        // Mouse glow
        const mx = this.mouse.x;
        const my = this.mouse.y;
        if (mx > 0 && my > 0 && this.glowRadius > 0) {
            switch (this.glowStyle) {
                case 'moon':
                    // Inner bright core
                    const coreGlow = ctx.createRadialGradient(mx, my, 0, mx, my, this.glowRadius * 0.15);
                    coreGlow.addColorStop(0, 'rgba(255, 250, 220, 0.4)');
                    coreGlow.addColorStop(1, 'transparent');
                    ctx.fillStyle = coreGlow;
                    ctx.fillRect(mx - this.glowRadius * 0.15, my - this.glowRadius * 0.15, this.glowRadius * 0.3, this.glowRadius * 0.3);

                    // Outer soft halo
                    const moonHalo = ctx.createRadialGradient(mx, my, 0, mx, my, this.glowRadius * 0.8);
                    moonHalo.addColorStop(0, 'rgba(212, 168, 67, 0.15)');
                    moonHalo.addColorStop(0.4, 'rgba(212, 168, 67, 0.05)');
                    moonHalo.addColorStop(1, 'transparent');
                    ctx.fillStyle = moonHalo;
                    ctx.fillRect(mx - this.glowRadius, my - this.glowRadius, this.glowRadius * 2, this.glowRadius * 2);
                    break;
                case 'halo':
                    const goldenHalo = ctx.createRadialGradient(mx, my, this.glowRadius * 0.4, mx, my, this.glowRadius);
                    goldenHalo.addColorStop(0, 'transparent');
                    goldenHalo.addColorStop(0.5, 'rgba(212, 168, 67, 0.15)');
                    goldenHalo.addColorStop(1, 'transparent');
                    ctx.fillStyle = goldenHalo;
                    ctx.fillRect(mx - this.glowRadius, my - this.glowRadius, this.glowRadius * 2, this.glowRadius * 2);
                    break;
                case 'subtle':
                    const subtleGlow = ctx.createRadialGradient(mx, my, 0, mx, my, this.glowRadius * 0.7);
                    subtleGlow.addColorStop(0, 'rgba(212, 168, 67, 0.06)');
                    subtleGlow.addColorStop(1, 'transparent');
                    ctx.fillStyle = subtleGlow;
                    ctx.fillRect(mx - this.glowRadius, my - this.glowRadius, this.glowRadius * 2, this.glowRadius * 2);
                    break;
            }
        }

        ctx.restore();
    }
}

// ============================================================
// INIT
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('asciiCanvas');
    new AsciiEngine(canvas);
});
