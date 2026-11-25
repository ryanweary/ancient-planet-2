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

The v2 visual pass renders the game with Three.js r169. It uses PBR materials, soft shadows, an HDRI environment, bloom and a per-biome colour grade.

**Textures and HDRI.** All are CC0 from [Poly Haven](https://polyhaven.com), downsized to 1024/512 px and stored in `assets/`.

- **Textures:** rocky_terrain_02, dry_ground_01, granite_tile, aerial_rocks_02, rock_face, snow_02, coast_sand_01, burned_ground_01, brown_mud_leaves_01, forest_ground_04, concrete_floor_worn_001, metal_plate, leafy_grass.
- **HDRI:** kloofendal_48d_partly_cloudy_puresky.

**Models.** Rocks, stumps, ferns, shrubs, crates and palms are CC0 photoscans from Poly Haven. Trees are impostors baked from Poly Haven's high-poly CC0 trees. Enemies are skinned, animated CC0 models by Quaternius. All are compressed with meshopt, KTX2 and WebP. Towers and the temple base are still procedural multi-part models built in code (`js/gfx/models.js`). **See [CREDITS.md](CREDITS.md) for every asset, its author and its licence.**

**Procedural textures.** The carved path slabs, armour, metal, energy dome, grass tufts and particle sprites are generated at runtime (`js/gfx/tex.js`).

No art, audio or code from the original Ancient Planet game is included.
