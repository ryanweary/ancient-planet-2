# Ancient Planet II: Return to Hamal

A fan-made tower defense sequel built with Three.js. It has 40 new levels across 8 continents. Everything is original: the 3D art is procedural, and the code, story and characters were all written for this project. It is not affiliated with the developers of the original game.

**Play:** https://ryanweary.github.io/ancient-planet-2/ (portrait, touch first; it also works with a mouse)

## Features
- Enemies follow a fixed road. You can build on any free tile, and Tide Cannons go on water.
- Towers: Machine Gun, Energy Crystal (splash), Cryogen (slowing beam), Rocket Battery, Tide Cannon, Soul Reaper, Armor Destroyer, Amplifier (support) and Ore Factory. Each tower has 2 upgrades, then you pick one of 2 branches with 2 more levels each.
- Ore Factories sit on glowing deposits and make coins that you tap to collect.
- Two enemy races with opposite weaknesses. Enemy types include troopers, skitters, armored tanks, gliders, juggernauts and Warlord bosses.
- Powers: Barricade, Minefield, Stasis Pulse and Orbital Lance, each with charges and a cooldown.
- Tap crosshair rocks to fire the temple laser at them (gold + Cores). Beacons boost nearby enemies.
- A next-wave preview, with bonus gold for calling waves early. Also fast-forward and pause.
- 0–3 stars per level (X/120 total) and an emerald upgrade tree (Towers / Weapon / Base) with buy, undo and a free reset.
- Comic story cards, Easy mode, generated music and sound effects, adaptive graphics quality, offline play as a PWA, and saves in localStorage.

## Debug flags
`?level=3-2` · `?auto` (AI plays) · `?god` · `?speed=3` · `?q=1..3` · `?unlock` · `?easy` · `?screen=map|upg|info|set`

No build step: it is static files with three@0.169 loaded from a CDN via an import map.

## Graphics & asset credits

The HD pass renders the game with Three.js r169 and four quality tiers (Low / Med / High / Ultra, auto-detected; High on modern phones, changeable in Settings):

- **Terrain:** photoscanned PBR layers (albedo, normal, height, AO, roughness) per biome, height-blended splat, parallax offset on High+, wet shorelines, rounded trench paths.
- **Lighting:** HDRI image-based lighting, PCF soft shadows (PCSS contact-hardening shadows on Ultra), N8AO ambient occlusion (High+).
- **Water:** depth-tinted, reflective water with animated normals and shoreline foam.
- **Vegetation:** instanced grass blades with wind (High+), baked tree impostors.
- **Post:** bloom, ACES filmic tonemapping, colour grade with split-toning and vignette, tilt-shift depth of field (High+), film grain and chromatic aberration (Ultra), SMAA.
- **FX:** GPU-integrated particles, beams, flares, scorch decals and screen shake.

**Textures and HDRI.** All are CC0 from [Poly Haven](https://polyhaven.com). The 24 terrain sets are in `assets/terrain/` (KTX2), a few prop textures are in `assets/tex/`, and the HDRI is `assets/sky.hdr`.

**Models.** Rocks, stumps, ferns, shrubs, crates and palms are CC0 photoscans from Poly Haven. Trees are impostors baked from Poly Haven's high-poly CC0 trees. Enemies are skinned, animated CC0 models by Quaternius. All are compressed with meshopt, KTX2 and WebP. Towers and the temple base are still procedural multi-part models built in code (`js/gfx/models.js`). **See [CREDITS.md](CREDITS.md) for every asset, its author and its licence.**

**Procedural textures.** The armour, metal, energy dome, grass tufts and particle sprites are generated at runtime (`js/gfx/tex.js`).

No art, audio or code from the original Ancient Planet game is included.
