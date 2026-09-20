# Kabichans

A cozy, interactive 3D meadow with 100 tabby-and-white cat villagers living their little lives. Built with React, TypeScript, Vite, and Three.js.

## Getting Started

### Prerequisites

- Node.js 22.12 or newer
- Modern browser with WebGL 2 support

### Run Locally

```sh
npm install
npm run dev
```

Open the local URL printed in your terminal (typically `http://127.0.0.1:5173`).

## Controls & Interaction

- **Navigate**: Click & drag, WASD, or arrow keys to pan around the meadow. Scroll or use `+` / `-` to zoom.
- **Interact**: Click any cat to inspect their personality, current activity, and thoughts. Click "Follow" to track them.
- **Treats**: Scatter treats across the meadow and watch nearby cats gather to eat.
- **Resident Directory**: Search and jump to any of the 100 villagers.
- **World Controls**: Toggle time of day (Afternoon, Golden Hour, Evening), simulation speed (0.5×, 1×, 2×), and camera curvature settings.

## Scripts

- `npm run dev`: Start the local Vite development server
- `npm run build`: Typecheck and produce an optimized production build in `dist/`
- `npm run preview`: Preview the production build locally
- `npm run check`: Run linter, unit tests, and build check
- `npm run test`: Run Vitest simulation test suite
- `npm run test:e2e`: Run Playwright end-to-end browser tests
- `npm run format`: Format code with Prettier
