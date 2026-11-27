# Ancient Planet II: Return to Hamal

A fan-made tower defense sequel built with Three.js. It has 40 new levels across 8 continents. Everything is original: the 3D art is procedural, and the code, story and characters were all written for this project. It is not affiliated with the developers of the original game.

**Play:** https://ryanweary.github.io/ancient-planet-2/ (portrait, touch first; it also works with a mouse)

## Features
- Enemies follow a fixed road. You can build on any free tile, and Tide Cannons go on water.
- Towers: Machine Gun, Energy Crystal (splash), Cryogen (slowing beam), Rocket Battery, Tide Cannon, Soul Reaper, Armor Destroyer, Amplifier (support) and Ore Factory. Each tower has 2 upgrades, then you pick one of 2 branches with 2 more levels each.
- Ore Factories sit on glowing deposits and make coins that you tap to collect.
- Two enemy races with opposite weaknesses. Enemy types include troopers, skitters, armored tanks, gliders, juggernauts, Menders (heal allies), Bulwarks (damage-reducing barrier), Hive Carriers (burst into Skitters) and cloaking Wraiths (only Amplifiers reveal them).
- Warlord bosses have abilities that change by world: summoning swarms, healing, shields when wounded, cloaking, EMP that stuns towers, and charges.
- **Twists:** from world 2 on, most levels change one or two rules (Dense Fog, Gold Rush, Armored Column, Swift Assault, Ion Storm, Supply Drops, Regeneration, Bounty Hunt, Air Raid, Horde, Scarce Ground). The level card shows them before you play.
- **Endless mode** (unlocks after 1-5): pick any reached world and survive. A Warlord with random abilities arrives every 10 waves and a new mutation stacks on every 10 waves. Best wave per world is saved, and every wave earns emeralds.
- Powers: Barricade, Minefield, Stasis Pulse and Orbital Lance, each with charges and a cooldown.
- Tap crosshair rocks to fire the temple laser at them (gold + Cores). Beacons boost nearby enemies.
- A next-wave preview, with bonus gold for calling waves early. Also fast-forward and pause.
- 0–3 stars per level (X/120 total) and an emerald upgrade tree (Towers / Weapon / Base) with buy, undo and a free reset. Each tower has two unique perks (crits, burn, brittle, armor shred, executioner, flak and more), and the Base tab adds Salvage, Interest and Temple Mending.
- Balance is fitted per level by simulation (`node tests/balance.mjs fit`): with the upgrades a typical player owns by then, a careful player can get 3 stars, but it takes work.
- Comic story cards, Easy mode, generated music and sound effects, adaptive graphics quality, offline play as a PWA, and saves in localStorage.

## Debug flags
`?level=3-2` · `?auto` (AI plays) · `?god` · `?speed=3` · `?q=1..3` · `?unlock` · `?easy` · `?screen=map|upg|info|set` · `?endless=1..8` (Endless in that world)

No build step: it is static files with three@0.169 loaded from a CDN via an import map.

## Graphics & asset credits

The HD pass renders the game with Three.js r169 and four quality tiers (Low / Med / High / Ultra, auto-detected; High on modern phones, changeable in Settings):

- **Terrain:** photoscanned PBR layers (albedo, normal, height, AO, roughness) per biome, height-blended splat, parallax offset on High+, wet shorelines, rounded trench paths.
- **Lighting:** HDRI image-based lighting, PCF soft shadows (PCSS contact-hardening shadows on Ultra), N8AO ambient occlusion (High+).
- **Water:** depth-tinted, reflective water with animated normals and shoreline foam.
- **Vegetation:** instanced grass blades with wind (High+), baked tree impostors.
- **Post:** bloom, ACES filmic tonemapping, a vivid colour grade with split-toning and a light vignette, and SMAA. Ultra adds subtle tilt-shift, film grain and chromatic aberration. High stays crisp (no blur passes), which also keeps phones cool.
- **FX:** GPU-integrated particles, beams, flares, scorch decals and screen shake.

**Textures and HDRI.** All are CC0 from [Poly Haven](https://polyhaven.com). The 24 terrain sets are in `assets/terrain/` (KTX2), a few prop textures are in `assets/tex/`, and the HDRI is `assets/sky.hdr`.

**Models.** Rocks, stumps, ferns, shrubs, crates and palms are CC0 photoscans from Poly Haven. Trees are impostors baked from Poly Haven's high-poly CC0 trees. Enemies are skinned, animated CC0 models by Quaternius: textured, weathered walking mechs for the Rustborn, and crystal creatures with glowing shards for the Glimmerkin. All are compressed with meshopt, KTX2 and WebP. Towers and the temple base are still procedural multi-part models built in code (`js/gfx/models.js`). **See [CREDITS.md](CREDITS.md) for every asset, its author and its licence.**

**Procedural textures.** The armour, metal, energy dome, grass tufts and particle sprites are generated at runtime (`js/gfx/tex.js`).

No art, audio or code from the original Ancient Planet game is included.
