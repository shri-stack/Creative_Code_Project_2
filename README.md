# Creative_Code_Project_2

## 🎨 Features

### Belle (Belle.js)

- Gaze-Driven Growth: Keep your nose inside the on-screen box to grow branches and leaves.

- Interactive Bloom: Click after ~60% growth to trigger a floral bloom.

- Stage-Based Feedback: Cheer messages at 30%, 60%, and bloom completion.

- Session Control: Shaky shy stage, retry or return to menu on completion.

### Blobert (sketch2.js)

- Gaze Tracking: Red nose dot tracks your face; looks for sustained center gaze.

- State Machine: Four states—calm, looming, fadeOut, respawn—with custom chat reactions.

- Mimic Expressions: Mouth shape follows your own mouth openness.

- Confetti Celebration: Fire confetti after 7s of steady gaze.

- Bounce & Dance: Final milestone triggers bouncy motions and sound effect.

### Belle&Blobert.html

- Split Menu Interface: Two halves to select Belle or Blobert.

- Modal Instructions: Clear guidance for each sketch and main menu.

- Image Upload: Replace menu thumbnails by uploading your own images.

- Responsive Layout: Full-window canvas, mobile-friendly styling.

## 🔧 Dependencies

- p5.js (v1.4.0) for canvas rendering

- ml5.js (v0.12.2) for FaceMesh predictions

- Google Fonts: Great Vibes

All libraries are loaded via CDN—no build step required.

## 📝 Usage Tips

- Lighting: Ensure your face is well-lit so FaceMesh can detect landmarks reliably.

- Background: A plain background helps avoid false detections.

- Performance: Close other heavy tabs; these sketches run at ~60 FPS.
