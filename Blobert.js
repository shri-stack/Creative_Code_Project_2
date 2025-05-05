// sketch2.js - Interactive Blob with Face Engagement

let video, facemesh, predictions = [];
let modelReady = false;

// Flags for celebrating sustained gaze milestones
let celebrated20 = false,
    celebrated25 = false,
    celebrated30 = false;

// Nose position for gaze tracking
let noseX = -100, noseY = -100;

// State machine variables: calm → looming → fadeOut → respawn
let lastSeenTS = 0,
    lastFaceTS = 0,
    state = 'calm',
    stateStartTS = 0;

// Appearance targets for blob
let blobHue = 120,     // hue in HSB
    blobSizeFrac = 0.3,
    blobAlpha = 1.0;

// Sound, confetti, and game control variables
let scream, screamPlayed = false;
let confetti = [], confettiFired = false, gazeStartTS = 0;
let userMouthOpen = 0, MOUTH_OPEN_LERP = 0.6;
let triggerBounce = false;
let gameOver = false, retryRect, menuRect;

// Preload scream sound
function preload() {
    scream = loadSound('Scream.mp3');
}

// Setup canvas, video, and FaceMesh model
function setup() {
    const cnv = createCanvas(windowWidth, windowHeight);
    cnv.parent('sketch-container');
    cnv.style('position', 'absolute');
    cnv.style('top', '0px');
    cnv.style('left', '0px');
    cnv.style('z-index', '1');

    colorMode(HSB);
    noStroke();

    // Initialize webcam capture
    video = createCapture({ video: { width: windowWidth, height: windowHeight } }, () => {
        video.size(windowWidth, windowHeight);
        video.hide();
    });

    facemesh = ml5.facemesh(video, { maxFaces: 1 }, () => modelReady = true);
    facemesh.on('predict', handlePredictions);

    lastSeenTS = lastFaceTS = millis();
    stateStartTS = millis();
}

// Adjust canvas and video on window resize
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    video.size(windowWidth, windowHeight);
}

// Update predictions, nose position, and mouth openness
function handlePredictions(results) {
    predictions = results;
    if (predictions.length) {
        lastFaceTS = millis();
        [noseX, noseY] = predictions[0].scaledMesh[1];
        let top = predictions[0].scaledMesh[13],
            bot = predictions[0].scaledMesh[14],
            d = dist(top[0], top[1], bot[0], bot[1]);
        userMouthOpen = constrain(map(d, 5, 25, 0, 1), 0, 1);
    }
}

// Allow ESC to end session early
function keyPressed() {
    if (keyCode === ESCAPE && !gameOver) {
        triggerSessionEnd();
    }
}

// Main draw loop: tracking, state transitions, and rendering
function draw() {
    if (gameOver) {
        drawSessionEndOverlay();
        return;
    }

    background(220);

    // Show small video preview
    const vw = 320, vh = 240, m = 20,
        vx = width - vw - m, vy = height - vh - m;
    image(video, vx, vy, vw, vh);

    // Map nose to screen and draw red nose dot
    const screenX = map(noseX, 0, video.width, 0, width);
    const screenY = map(noseY, 0, video.height, 0, height);
    noStroke(); fill(0, 100, 100);
    ellipse(screenX, screenY, 12);

    // Check if user is looking at center box
    let seen = false;
    if (modelReady && predictions.length) {
        if (
            abs(screenX - width / 2) < width * 0.2 &&
            abs(screenY - height / 2) < height * 0.2
        ) {
            seen = true;
            if (!gazeStartTS) gazeStartTS = millis();
            if (!confettiFired && millis() - gazeStartTS > 7000) {
                fireConfetti();
                confettiFired = true;
            }
            lastSeenTS = millis();
        } else {
            gazeStartTS = 0;
        }
    }

    // Auto-end if face lost for 30s
    if (millis() - lastFaceTS > 30000) {
        triggerSessionEnd();
        return;
    }

    // State transition logic based on gaze and timers
    let now = millis(),
        ignored = (now - lastSeenTS) / 1000,
        elapsed = (now - stateStartTS) / 1000,
        gazeDur = gazeStartTS ? (now - gazeStartTS) / 1000 : 0;

    if (seen && state !== 'calm') changeState('calm');
    else if (!seen && state === 'calm' && ignored > 2) changeState('looming');
    else if (state === 'looming' && elapsed > 3) changeState('fadeOut');
    else if (state === 'fadeOut' && elapsed > 10) changeState('respawn');
    else if (state === 'respawn' && elapsed > 2) changeState('calm');

    // Celebrate milestones during calm state
    if (state === 'calm') {
        if (gazeDur > 10 && !celebrated20) {
            showChat("😊 I'm feeling bright!"); celebrated20 = true;
        }
        if (gazeDur > 15 && !celebrated25) {
            showChat("💙 So cool and calm..."); celebrated25 = true;
        }
        if (gazeDur > 20 && !celebrated30) {
            showChat("🌟 You're my favorite human!");
            celebrated30 = true; triggerBounce = true;
        }
    }

    // Determine target appearance based on state
    let tHue, tSize, tAlpha;
    switch (state) {
        case 'calm':
            tHue = (gazeDur > 20) ? 300 : (gazeDur > 15) ? 240 : (gazeDur > 10) ? 60 : 120;
            tSize = 0.3; tAlpha = 1;
            break;
        case 'looming':
            tHue = 0; tSize = 0.5; tAlpha = 1;
            break;
        case 'fadeOut':
            tHue = 0; tSize = 0.5; tAlpha = 0;
            break;
        case 'respawn':
            tHue = 0;
            tSize = lerp(0.05, 1.2, min(elapsed / 2, 1));
            tAlpha = 1;
            if (!screamPlayed && scream && !scream.isPlaying()) {
                scream.play(); screamPlayed = true;
            }
            break;
    }

    // Smoothly interpolate appearance
    blobHue = lerp(blobHue, tHue, 0.05);
    blobSizeFrac = lerp(blobSizeFrac, tSize, 0.05);
    blobAlpha = lerp(blobAlpha, tAlpha, 0.05);

    // Draw confetti behind blob
    drawConfetti();

    // Draw the blob with optional bounce/dance
    push();
    let dx = 0;
    if (seen && state === 'calm' && gazeDur > 30) dx = sin(frameCount * 0.1) * 20;
    translate(width / 2 + dx, height / 2);
    let r = blobSizeFrac * min(width, height);
    if (triggerBounce && seen) {
        let by = abs(sin(frameCount * 0.3)) * 30;
        translate(0, -by);
    } else {
        triggerBounce = false;
    }

    fill(blobHue, 200, 200, blobAlpha * 255);
    stroke(blobHue - 20, 255, 100, blobAlpha * 255);
    strokeWeight(min(width, height) * 0.05 * blobSizeFrac);
    beginShape();
    vertex(-r, r * 0.8);
    quadraticVertex(0, r * 1.0, r, r * 0.8);
    for (let a = 0; a <= PI; a += PI / 20) {
        vertex(r * cos(a), -r * sin(a));
    }
    endShape(CLOSE);

    // Eyes and mouth drawing
    noStroke(); fill(0, blobAlpha * 255);
    if (state === 'calm') {
        ellipse(-r * 0.4, -r * 0.2, r * 0.15);
        ellipse(r * 0.4, -r * 0.2, r * 0.15);
    } else {
        stroke(0, blobAlpha * 255); strokeWeight(r * 0.04);
        line(-r * 0.45, -r * 0.25, -r * 0.35, -r * 0.15);
        line(r * 0.45, -r * 0.25, r * 0.35, -r * 0.15);
        noStroke();
    }

    fill(255, 200, 200, blobAlpha * 255);
    triangle(0, 0, -r * 0.05, r * 0.1, r * 0.05, r * 0.1);

    stroke(0, blobAlpha * 255); strokeWeight(r * 0.04); noFill();
    let mout = lerp(0, userMouthOpen, MOUTH_OPEN_LERP);
    if (state === 'calm') {
        arc(0, r * 0.3, r * 0.4, r * 0.2 + mout * r * 0.3, PI * 0.1, PI * 0.9);
    } else {
        arc(0, r * 0.3, r * 0.6, r * 0.4 + mout * r * 0.5, PI * 0.9, PI * 1.1);
    }
    pop();
}

// Handle entering a new state and show chat message
function changeState(ns) {
    state = ns;
    stateStartTS = millis();
    if (ns === 'calm') {
        celebrated20 = celebrated25 = celebrated30 = false;
        showChat("Yay! You're looking at me!");
        triggerBounce = false;
    }
    else if (ns === 'looming') showChat("😡 Why aren't you looking at me?");
    else if (ns === 'fadeOut') showChat("😢 Stop ignoring me!");
    else if (ns === 'respawn') {
        showChat("💥 Boom—I'm back!");
        screamPlayed = false;
    }
}

// Prepare retry/menu buttons on session end
function triggerSessionEnd() {
    gameOver = true;
    let bw = 240, bh = 60;
    retryRect = { x: width / 2 - bw / 2, y: height / 2 + 20, w: bw, h: bh };
    menuRect = { x: retryRect.x, y: retryRect.y + bh + 20, w: bw, h: bh };
}

// Draw overlay and buttons when session ends
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

// Draw a rounded gradient button
function drawButton(r, c1, c2, label) {
    const ctx = drawingContext;
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, c1.toString()); g.addColorStop(1, c2.toString());
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(r.x + 12, r.y); ctx.lineTo(r.x + r.w - 12, r.y);
    ctx.quadraticCurveTo(r.x + r.w, r.y, r.x + r.w, r.y + 12);
    ctx.lineTo(r.x + r.w, r.y + r.h - 12);
    ctx.quadraticCurveTo(r.x + r.w, r.y + r.h, r.x + r.w - 12, r.y + r.h);
    ctx.lineTo(r.x + 12, r.y + r.h);
    ctx.quadraticCurveTo(r.x, r.y + r.h, r.x, r.y + r.h - 12);
    ctx.lineTo(r.x, r.y + 12);
    ctx.quadraticCurveTo(r.x, r.y, r.x + 12, r.y); ctx.closePath(); ctx.fill();
    noStroke(); fill(255);
    textSize(22); textAlign(CENTER, CENTER);
    text(label, r.x + r.w / 2, r.y + r.h / 2);
}

// Confetti particle class
class Confetto {
    constructor() {
        this.x = random(width); this.y = -10;
        this.size = random(5, 15); this.col = color(random(360), 80, 100);
        this.speed = random(2, 5); this.rot = random(TWO_PI);
        this.omega = random(-0.1, 0.1);
    }
    update() { this.y += this.speed; this.rot += this.omega; }
    show() {
        push(); translate(this.x, this.y); rotate(this.rot);
        noStroke(); fill(this.col);
        rect(0, 0, this.size, this.size * 0.4);
        pop();
    }
}

// Spawn confetti particles
function fireConfetti() {
    for (let i = 0; i < 200; i++) confetti.push(new Confetto());
}

// Update and draw confetti
function drawConfetti() {
    for (let i = confetti.length - 1; i >= 0; i--) {
        confetti[i].update(); confetti[i].show();
        if (confetti[i].y > height + 20) confetti.splice(i, 1);
    }
}

// Display chat messages in bubble
function showChat(msg) {
    const cb = select('#chatBubble'); if (!cb) return;
    cb.html(msg)
        .style('display', 'block')
        .style('opacity', '0')
        .style('transform', 'translateX(-50%) scale(0)')
        .style('font-size', '2rem');
    void cb.elt.offsetWidth;
    cb.style('transition', 'transform 0.3s ease-out, opacity 0.3s ease-out')
        .style('opacity', '1')
        .style('transform', 'translateX(-50%) scale(1)');
    setTimeout(() => {
        cb.style('opacity', '0').style('transform', 'translateX(-50%) scale(0)');
    }, 4000);
}

// Handle clicks on retry or menu buttons
function mousePressed() {
    if (!gameOver) return;
    const mx = mouseX, my = mouseY;
    // Retry
    if (mx >= retryRect.x && mx <= retryRect.x + retryRect.w &&
        my >= retryRect.y && my <= retryRect.y + retryRect.h) {
        gameOver = false; state = 'calm';
        lastSeenTS = lastFaceTS = millis(); stateStartTS = millis();
        confetti = []; confettiFired = false;
        celebrated20 = celebrated25 = celebrated30 = false;
        triggerBounce = false; return;
    }
    // Main menu
    if (mx >= menuRect.x && mx <= menuRect.x + menuRect.w &&
        my >= menuRect.y && my <= menuRect.y + menuRect.h) {
        location.href = location.pathname;
    }
}
