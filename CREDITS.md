# Asset credits

Ancient Planet II uses only openly licensed third-party art. Nothing from the original Ancient Planet game is included.

All the files below were downloaded from their original sources. They were then re-processed for the web with
[glTF Transform](https://gltf-transform.dev):

- meshoptimizer simplification and `EXT_meshopt_compression` geometry
- KTX2 / Basis Universal (ETC1S) colour and ORM maps
- WebP normal maps
- textures capped at 512 px

The build script is kept outside the repo; the shipped files are in `assets/models/` and `assets/trees/`.

## Poly Haven: CC0 1.0 (public domain)

Source: https://polyhaven.com. No attribution is required, but credit is given here anyway.

### Photoscanned models (`assets/models/*.glb`)

| Asset | Authors |
| --- | --- |
| Rock 07, Rock 09, Namaqualand Boulder 04 | Jenelle van Heerden |
| Namaqualand Boulder 05 | Jenelle van Heerden, Dario Barresi |
| Stone 01 | Dario Barresi, Rico Cilliers |
| Rock Moss Set 01 | Kless Gyzen |
| Moon Rock 01 / 03 / 05 | Greg Zaal, Rico Cilliers, Jenelle van Heerden, Dario Barresi |
| Coast Rocks 01 | Rob Tuytel, Rico Cilliers |
| Tree Stump 01, Dead Tree Trunk | Rob Tuytel |
| Fern 02 | Rob Tuytel, Rico Cilliers |
| Shrub 03 | Rico Cilliers |
| Quiver Tree 02 | Dario Barresi, Rico Cilliers |
| Dead Quiver Trunk | James Ray Cock, Dario Barresi, Rico Cilliers |
| Old Military Crate | Jack Mava |
| Barrel 03 | Serhii Khromov |

### Tree impostors (`assets/trees/trees.webp`)

These are pre-rendered from the following Poly Haven models at the game's camera angle:

| Asset | Authors |
| --- | --- |
| Pine Sapling Small, Fir Sapling, Island Tree 02, Jacaranda Tree | Rob Tuytel, Rico Cilliers |
| Tree Small 02, Shrub 04 | Rico Cilliers |
| Quiver Tree 02 | Dario Barresi, Rico Cilliers |

### PBR terrain layers (`assets/terrain/*.ktx2`)

Each set is packed as KTX2/Basis ETC1S: `<name>_c` holds albedo × AO with the displacement map in alpha (used for height blending and parallax), and `<name>_n` holds the OpenGL normal map. Top and path layers are 1024 px; patch and cliff layers are 512 px.

aerial_grass_rock, dirt_floor, coast_sand_01, coast_sand_05, aerial_beach_01, snow_field_aerial, snow_03, brown_mud_leaves_01, muddy_tracks, burned_ground_01, cracked_red_ground, rocks_ground_05, stone_pathway, dry_ground_rocks, concrete_floor_worn_001, gravel_road, forest_ground_04, rock_face, rock_face_03, rock_face_04, rock_pitted_mossy, dark_rock, aerial_rocks_02, metal_plate (all Poly Haven, CC0).

### Other textures and HDRI (`assets/tex/`, `assets/sky.hdr`)

- **Textures (prop and model materials):** granite_tile, aerial_rocks_02, rock_face, leafy_grass.
- **HDRI:** kloofendal_48d_partly_cloudy_puresky (Greg Zaal).

## Quaternius: CC0 1.0 (public domain)

Animated, skinned enemy models. Source: https://quaternius.com, downloaded via https://poly.pizza.

| File | Original model |
| --- | --- |
| `e_rust_grunt.glb` | Robot Enemy (Rustborn Mender) |
| `e_rust_brute.glb` | Robot Enemy Large (Rustborn Hive Carrier) |
| `e_rust_tank.glb` | Robot Enemy Large Gun (Rustborn Bulwark) |
| `e_rust_flyer.glb` | Robot Enemy Flying Gun |
| `e_spider.glb` | Spider |
| `e_glim_tank.glb` | Crab Enemy |
| `e_glim_brute.glb` | Alien |
| `e_glim_flyer.glb` | Glub Evolved |
| `e_glim_boss.glb` | Dragon Evolved |

| `e_glim_flyer.glb` is also the Glimmerkin Mender. | |

**Animated Mech Pack (March 2021)** and **Animated Monster Pack**, by Quaternius, CC0 1.0. Source: https://opengameart.org/content/animated-mech-pack and https://opengameart.org/content/lowpoly-animated-monsters, taken from the CC0 mirror at https://github.com/zuujis-cc0/opengameart-quaternius-3d-art. Converted from FBX with three.js (FBXLoader to GLTFExporter), trimmed to the walk/run/death clips, then meshopt-compressed with 512 px WebP textures. The mech textures were repainted from teal/green to Rustborn red-orange.

| File | Original model | Used as |
| --- | --- | --- |
| `e_mech_leela.glb` | Leela | Rustborn Trooper, Wraith |
| `e_mech_stan.glb` | Stan | Rustborn Crawler Tank |
| `e_mech_george.glb` | George | Rustborn Juggernaut |
| `e_mech_mike.glb` | Mike | Rustborn Warlord |
| `e_mon_slime.glb` | Slime | Glimmerkin Trooper |
| `e_mon_skeleton.glb` | Skeleton | Glimmerkin Wraith |
| `e_mon_bat.glb` | Bat | Glimmerkin Glider |
| `e_mon_dragon.glb` | Dragon | Glimmerkin Hive Carrier |

At runtime, the textured mechs keep their paint and weathering, tinted toward the Rustborn palette. Untextured models are recoloured: rust armour for Rustborn, and for Glimmerkin a crystal ramp that keeps each model's light/dark structure, with an inner glow, a fresnel rim, and glowing crystal shards attached to the spine bone.

## Libraries

- [three.js](https://threejs.org) r169 (MIT), including its GLTFLoader, KTX2Loader with the Basis transcoder, the meshopt decoder, UnrealBloomPass and SMAAPass.
- [N8AO](https://github.com/N8python/n8ao) 2.1.0 by N8python (CC0), bundled as `js/vendor/n8ao.min.js` (licence in `js/vendor/N8AO-LICENSE.txt`) for screen-space ambient occlusion.
