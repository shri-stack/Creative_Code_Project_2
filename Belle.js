// Belle.js - Interactive Growing Tree with Face Engagement
// Comments added for clarity and a more human-friendly style

// Disable p5 friendly error messages to improve performance
p5.disableFriendlyErrors = true;

// ─── PALETTE CONSTANTS ─────────────────────────────────
// Define colors used in the sky, wood, and UI bars
const SKY_TOP = '#FFE3B3'; // Top color of sky gradient
const SKY_BOT = '#FFB7A5'; // Bottom color of sky gradient
const WOOD_BASE = '#A0522D'; // Base color of branch wood
const WOOD_TIP = '#8B4513'; // Tip color of branch wood
const BAR0_HEX = '#FF8C00'; // Color for stage 0 progress bar (calm)
const BAR1_HEX = '#B22222'; // Color for stage 1 progress bar (flowering)
const BAR2_HEX = '#B22222'; // Color for stage 2 progress bar (shy)
const DEAD_HEX = WOOD_TIP;  // Color when the tree is dying
const POEM_HEX = '#FAF3E0'; // Color for any poem/text (unused here)

// ─── LAYOUT CONSTANTS ─────────────────────────────────
// Video preview dimensions and padding
const VIDEO_W = 300;
const VIDEO_H = 175;
const VIDEO_BUF = 20;

// ─── TREE & LEAF CONSTANTS ─────────────────────────────
// Growth durations per stage (in seconds)
const DUR = [40, 20, 20];
const M = 0.43;   // Margin factor for engagement box
const INITIAL_LENGTH = 280;    // Initial branch length
const MAX_DEPTH = 7;      // Maximum recursion depth for branches
const LEAF_MAX_SIZE = 40;     // Maximum width of any leaf

// ─── GLOBALS ────────────────────────────────────────────
let video, faceMesh, predictions = [], modelReady = false;
let calmCol, yellowCol, redCol, deadCol, moodCol;
let stage = 0; // current growth stage (0: growing, 1: flowering, 2: shy)
let barProg = 0; // progress through current stage
let growth = 0; // normalized growth amount [0..1]
let lookAwayTS = null; // timestamp when user looked away

// Tree and leaf angle/offset per depth level
let angleTree = [], leafOffsets = [], leafAngles = [];
let startTime = 0;

// Particle system and bloom flags
let particles = [];
let drawFlowers = false;
let gameOver = false;
let retryRect, menuRect;

// Flags to trigger chat messages exactly once per event
let lastStage = -1;
let leafHalfFlag = false;
let bloomInstructionFlag = false;
let bloomCompleteFlag = false;
let prettyFlag = false;
let sweetFlag = false;
let shyFlag = false;
let hideFlag = false;

// DOM elements for prompts and chat bubble
let nosePrompt, chatBubble;

// Called once at start to set up canvas, video, and FaceMesh model
function setup() {
  // Create full-window canvas and attach to container
  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent('sketch-container');
  cnv.style('position', 'absolute');
  cnv.style('top', '0');
  cnv.style('left', '0');

  // Allow click to bloom only after enough growth
  cnv.mousePressed(() => {
    if (stage === 0 && growth < 0.6) {
      showChat("You might need to wait for me grow even more.");
    } else {
      drawFlowers = true;
    }
  });

  frameRate(60);
  colorMode(HSB);
  angleMode(DEGREES);

  // Grab on-screen prompt elements
  nosePrompt = select('#nosePrompt');
  chatBubble = select('#chatBubble');
  chatBubble.style('display', 'none');

  // Convert hex colors to p5 Color objects
  calmCol = color(BAR0_HEX);
  yellowCol = color(BAR1_HEX);
  redCol = color(BAR2_HEX);
  deadCol = color(DEAD_HEX);
  moodCol = calmCol;

  // Initialize webcam capture (hidden) for FaceMesh input
  video = createCapture({ video: { width: windowWidth, height: windowHeight } },
    () => video.hide()  // hide default element
  );
  video.size(windowWidth, windowHeight);
  video.hide();

  // Load face mesh model from ml5
  faceMesh = ml5.facemesh(video, { maxFaces: 1 }, () => modelReady = true);
  faceMesh.on('predict', res => predictions = res);

  // Record start time (in seconds)
  startTime = millis() / 1000;

  // Pre-generate random branch angles and leaf positions
  for (let lvl = 0; lvl <= MAX_DEPTH; lvl++) {
    angleTree.push({ left: random(15, 45), right: random(15, 45) });
    leafOffsets.push([0.25, 0.50, 0.75]);
    leafAngles.push([
      random(-PI / 4, PI / 4),
      random(-PI / 4, PI / 4),
      random(-PI / 4, PI / 4)
    ]);
  }
}

// Adjust canvas and video size when window is resized
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (video && video.size) video.size(windowWidth, windowHeight);
}

// Main draw loop, called each frame
function draw() {
  if (gameOver) {
    // If session ended, show end-over overlay
    triggerSessionEnd();
    drawSessionEndOverlay();
    return;
  }

  // Draw sky gradient background
  const ctx = drawingContext;
  let grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(1, SKY_BOT);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Draw simple clouds in four positions
  noStroke(); fill(255, 200);
  [[.08, .10], [.20, .08], [.35, .11], [.60, .09]].forEach(p => {
    ellipse(width * p[0], height * p[1], 80, 50);
    ellipse(width * (p[0] + .03), height * (p[1] - .01), 100, 60);
    ellipse(width * (p[0] + .06), height * p[1], 80, 50);
  });

  // Draw live video feed in bottom-right corner
  image(video, width - VIDEO_W - VIDEO_BUF, height - VIDEO_H - VIDEO_BUF, VIDEO_W, VIDEO_H);

  if (!modelReady) {
    // Show loading text until model loads
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(24);
    text("Loading FaceMesh…", width / 2, height / 2);
    return;
  }

  // Draw engagement box where user must look
  noFill(); stroke(255, 50);
  let zx = width * M, zy = height * M;
  let zw = width * (1 - 2 * M), zh = height * (1 - 2 * M);
  rect(zx, zy, zw, zh);

  // Check if user's nose landmark is inside engagement box
  let centered = false;
  if (predictions.length) {
    const [mx, my] = predictions[0].scaledMesh[1];
    const nx = map(mx, 0, video.width, 0, width);
    const ny = map(my, 0, video.height, 0, height);
    noStroke(); fill(255, 0, 0);
    ellipse(nx, ny, 12); // show nose point
    centered = nx > zx && nx < zx + zw && ny > zy && ny < zy + zh;
  }

  // Position or hide nose prompt based on centering
  nosePrompt.style('left', `${zx + zw / 2}px`);
  nosePrompt.style('top', `${zy + zh / 2}px`);
  nosePrompt.style('transform', 'translate(-50%, -50%)');
  nosePrompt.style('display', centered ? 'none' : 'flex');

  // Update growth progress when user keeps looking
  let dt = deltaTime / 1000;
  if (centered) {
    lookAwayTS = null;
    barProg = min(DUR[stage], barProg + dt);
    if (stage === 0) growth = min(1, growth + dt / DUR[0]);

    // Advance stage if progress completed
    if (barProg >= DUR[stage]) {
      if (stage === 2) { // final shy stage ends session
        triggerSessionEnd(); return;
      }
      let next = (stage + 1) % 3;
      if (next === 0) { // reset all flags on full cycle
        leafHalfFlag = bloomInstructionFlag = bloomCompleteFlag = false;
        prettyFlag = sweetFlag = false;
        shyFlag = hideFlag = false;
      }
      stage = next;
      barProg = 0;
      if (stage === 0) growth = 0;
    }
    if (stage === 0) particles.push(new Particle());

  } else {
    // If user looks away, regress progress or stage
    barProg = max(0, barProg - dt);
    if (stage === 0) {
      if (!lookAwayTS) lookAwayTS = millis();
      if (millis() - lookAwayTS >= DUR[0] * 1000)
        growth = max(0, growth - dt / DUR[0]);
    } else if (barProg <= 0) {
      stage = (stage + 2) % 3; // go back one stage
      barProg = DUR[stage];
      if (stage === 0) { growth = 1; lookAwayTS = null; }
    }
  }

  // Handle one-time chat messages on stage change
  if (stage !== lastStage) {
    lastStage = stage;
    leafHalfFlag = bloomInstructionFlag = bloomCompleteFlag = false;
    prettyFlag = sweetFlag = shyFlag = hideFlag = false;
  }

  // Stage 0: leaf growth messages at milestones
  if (stage === 0) {
    if (!leafHalfFlag && growth >= 0.3 && centered) {
      showChat("Yaaayyy!!! I am growing, thank you so much for giving me attention!!!");
      leafHalfFlag = true;
    }
    if (!bloomInstructionFlag && growth >= 0.6 && centered) {
      showChat("Click anywhere on the screen to make me bloom!!");
      bloomInstructionFlag = true;
    }
    if (!bloomCompleteFlag && drawFlowers) {
      showChat("I am so happy, I bloomed!!");
      bloomCompleteFlag = true;
    }
  }

  // Stage 1: flowering celebration
  if (stage === 1 && !prettyFlag) {
    prettyFlag = true;
    showChat("I look so pretty!");
    setTimeout(() => {
      showChat("You're so sweet! You are so caring!");
      sweetFlag = true;
    }, 6000);
  }

  // Stage 2: shy and hide messages
  if (stage === 2 && !shyFlag) {
    shyFlag = true;
    showChat("Don't look at me for so long, I'm very shy!");
    setTimeout(() => {
      showChat("I want to hide!!!");
      hideFlag = true;
    }, 6000);
  }

  // Update mood color based on stage progress
  if (stage === 0) moodCol = calmCol;
  else if (stage === 1) {
    growth = 1;
    let t = constrain(barProg / DUR[1], 0, 1);
    moodCol = lerpColor(calmCol, deadCol, t);
  } else {
    let t = constrain(barProg / DUR[2], 0, 1);
    growth = 1 - t;
    moodCol = deadCol;
  }

  // Update and draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].show();
    if (particles[i].isDead()) particles.splice(i, 1);
  }

  // Draw the growing tree at center bottom
  push();
  translate(width / 2, height);
  if (stage === 2) {
    // Add small shake effect when shy
    let s = 5 * (barProg / DUR[2]);
    translate(random(-s, s), random(-s, s));
  }
  let elapsed = millis() / 1000 - startTime;
  let maxL = floor(growth * MAX_DEPTH);
  animateBranch(INITIAL_LENGTH, 0, maxL, elapsed);
  pop();

  // UI: progress bar and FPS counter
  noStroke();
  fill(stage === 0 ? BAR0_HEX : stage === 1 ? BAR1_HEX : BAR2_HEX);
  rect(20, height - 30, map(barProg, 0, DUR[stage], 0, width - 40), 16);
  noStroke(); fill(255);
  textSize(14); textAlign(LEFT, TOP);
  text(int(frameRate()) + ' FPS', 10, 10);
}

// Display a chat message in the bubble with fade-in/out animation
function showChat(msg) {
  chatBubble
    .html(msg)
    .style('display', 'block')
    .style('opacity', '0')
    .style('transform', 'translateX(-50%) scale(0)');

  // Force reflow before animating in
  chatBubble.elt.offsetHeight;
  chatBubble
    .style('transition', 'transform .3s ease-out, opacity .3s ease-out')
    .style('opacity', '1')
    .style('transform', 'translateX(-50%) scale(1)');

  // Hide after 4 seconds
  setTimeout(() => {
    chatBubble
      .style('opacity', '0')
      .style('transform', 'translateX(-50%) scale(0)');
    setTimeout(() => chatBubble.style('display', 'none'), 300);
  }, 4000);
}

// Recursive function to draw branches and leaves
function animateBranch(len, level, maxL, elapsed) {
  if (level > maxL) return;

  const dur = 0.6, delay = level * dur;
  let prog = constrain((elapsed - delay) / dur, 0, 1);

  // Draw branch line with thickness tapering
  let col = lerpColor(color(WOOD_BASE), color(WOOD_TIP), level / maxL);
  stroke(col);
  strokeWeight(map(level, 0, maxL, 40 * growth, 4));
  line(0, 0, 0, -len * prog);
  if (prog < 1) return;

  push();
  translate(0, -len);
  if (level >= 4) drawLeavesAlong(len, level);
  if (drawFlowers && level > 2) {
    push();
    drawFlowerArt();
    pop();
  }

  // Recurse for left and right child branches
  let ang = angleTree[level];
  push(); rotate(ang.left);
  animateBranch(len * 0.7, level + 1, maxL, elapsed);
  pop();

  push(); rotate(-ang.right);
  animateBranch(len * 0.7, level + 1, maxL, elapsed);
  pop();

  pop();
}

// Draw leaves at three offsets along a branch
function drawLeavesAlong(len, depth) {
  const offs = leafOffsets[depth] || [];
  const angs = leafAngles[depth] || [];
  for (let i = 0; i < offs.length; i++) {
    push();
    translate(0, -len * offs[i]);
    rotate(angs[i]);
    let raw = INITIAL_LENGTH * growth * 0.3;
    let s = min(raw, LEAF_MAX_SIZE);
    let h = s * 0.6;
    noStroke(); fill(moodCol);
    ellipse(-s * 0.5, 0, s, h);
    ellipse(s * 0.5, 0, s, h);
    pop();
  }
}

// Draw a simple flower with 8 petals
function drawFlowerArt() {
  noStroke(); fill(330, 80, 100);
  for (let i = 0; i < 8; i++) { ellipse(0, 10, 12, 24); rotate(45); }
  fill(60, 100, 100); ellipse(0, 0, 16, 16);
}

// Particle class for celebratory confetti effect
class Particle {
  constructor() {
    this.pos = createVector(width / 2, height);
    this.vel = p5.Vector.fromAngle(random(-PI / 3, -2 * PI / 3)).mult(random(0.5, 1.5));
    this.l = 255;
  }
  update() { this.pos.add(this.vel); this.l -= 4; }
  show() { noStroke(); fill(50, this.l); ellipse(this.pos.x, this.pos.y, map(this.l, 0, 255, 4, 8)); }
  isDead() { return this.l <= 0; }
}

// Handle escape key to force session end
function keyPressed() {
  if (keyCode === ESCAPE && !gameOver) {
    triggerSessionEnd();
  }
}

// Mark session end and prepare retry/menu buttons
function triggerSessionEnd() {
  gameOver = true;
  let bw = 240, bh = 60;
  retryRect = { x: width / 2 - bw / 2, y: height / 2 + 20, w: bw, h: bh };
  menuRect = { x: retryRect.x, y: retryRect.y + bh + 20, w: bw, h: bh };
}

// Draw overlay at end of session with buttons
function drawSessionEndOverlay() {
  noStroke(); fill(0, 180); rect(0, 0, width, height);
  fill(40); stroke(255);
  rect(width / 2 - 160, height / 2 - 120, 320, 260, 12);
  noStroke(); fill(255);
  textAlign(CENTER, CENTER); textSize(32);
  text("Session Complete!", width / 2, height / 2 - 40);
  drawButton(retryRect, color(120, 255, 200), color(120, 200, 255), "RETRY");
  drawButton(menuRect, color(0, 255, 200), color(0, 200, 255), "MAIN MENU");
}

// Helper to draw a gradient button with rounded corners
function drawButton(r, c1, c2, label) {
  const ctx = drawingContext;
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, c1.toString());
  g.addColorStop(1, c2.toString());
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(r.x + 12, r.y);
  ctx.lineTo(r.x + r.w - 12, r.y);
  ctx.quadraticCurveTo(r.x + r.w, r.y, r.x + r.w, r.y + 12);
  ctx.lineTo(r.x + r.w, r.y + r.h - 12);
  ctx.quadraticCurveTo(r.x + r.w, r.y + r.h, r.x + r.w - 12, r.y + r.h);
  ctx.lineTo(r.x + 12, r.y + r.h);
  ctx.quadraticCurveTo(r.x, r.y + r.h, r.x, r.y + r.h - 12);
  ctx.lineTo(r.x, r.y + 12);
  ctx.quadraticCurveTo(r.x, r.y, r.x + 12, r.y);
  ctx.closePath();
  ctx.fill();
  noStroke(); fill(255);
  textSize(22); textAlign(CENTER, CENTER);
  text(label, r.x + r.w / 2, r.y + r.h / 2);
}

// Handle clicks on retry or main menu buttons
function mousePressed() {
  if (!gameOver) return;
  const mx = mouseX, my = mouseY;
  // Retry button region
  if (mx >= retryRect.x && mx <= retryRect.x + retryRect.w &&
    my >= retryRect.y && my <= retryRect.y + retryRect.h) {
    // Reset all state variables for a new session
    gameOver = false; stage = 0; barProg = 0; growth = 0; lookAwayTS = null;
    leafHalfFlag = bloomInstructionFlag = bloomCompleteFlag = false;
    prettyFlag = sweetFlag = shyFlag = hideFlag = false;
    return;
  }
  // Main menu button region
  if (mx >= menuRect.x && mx <= menuRect.x + menuRect.w &&
    my >= menuRect.y && my <= menuRect.y + menuRect.h) {
    // Reload page to return to main menu
    location.href = location.pathname;
  }
}
