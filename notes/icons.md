# App icons

- Source: `src/icons/nitzavim-1024.jpg` (1024×1024, copied from `scratch/`).
- `npm run icons` (`src/make-icons.js`, uses sharp) writes into `src/icons/`:
  `icon-{16,32,48,64,128,192,512}.png` and `apple-touch-icon-180.png`.
  The image is resized whole (centre-cropped if not square); sizes ≤48 get a
  light sharpen; all PNGs are palette-quantised to keep the page small.
  Other source/output: `npm run icons -- <source> <outDir>`.
- The generated PNGs are committed, so `npm run build` does not need sharp.
  `src/build.js` calls `iconLinks()` (`src/icons.js`) and inlines 16, 32, 48,
  192 and apple-touch-180 as data-URI `<link>` tags before `</head>` (~85 KB).
  A missing icon gives a warning; the build still succeeds.
- Tests: `test/icons.test.js`. The `makeIcons` test is skipped unless sharp is
  installed.
- To change the icon: replace the source image, run `npm run icons`, then build.
