# Neon Dodge

Neon Dodge is a fast-paced browser game built with vanilla HTML, CSS, and JavaScript.
Pilot your neon ship, dodge falling hazards, and collect power-ups to survive as long as possible.

## Run locally

1. Download or clone this repository.
2. Open `index.html` in any modern browser.

No build step or dependencies required.

## Controls

### Desktop
- Move: **Arrow keys** or **WASD**
- Pause/Resume: **P** or **Esc**

### Mobile
- Drag on the game area to move toward your finger.
- Or use the on-screen joystick (bottom-left).

## Gameplay

- Obstacles fall from the top and speed up over time.
- Difficulty scales with both obstacle speed and spawn rate.
- Score increases from:
  - Survival time
  - Collecting power-ups

### Power-ups
- **Shield (S)**: blocks one hit.
- **Slow Time (T)**: slows all world movement for 5 seconds.

## Features

- Neon visual style with starfield + grid backdrop.
- Smooth `requestAnimationFrame` loop.
- Hit feedback with screen shake and particle bursts.
- Persistent best score using `localStorage`.
- Responsive canvas that resizes with the browser window.

Enjoy the dodge run.
