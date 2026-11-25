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

### Textures and HDRI (`assets/tex/`, `assets/sky.hdr`)

- **Textures:** rocky_terrain_02, dry_ground_01, granite_tile, aerial_rocks_02, rock_face, snow_02, coast_sand_01, burned_ground_01, brown_mud_leaves_01, forest_ground_04, concrete_floor_worn_001, metal_plate, leafy_grass, plus any terrain sets listed in the README.
- **HDRI:** kloofendal_48d_partly_cloudy_puresky (Greg Zaal).

## Quaternius: CC0 1.0 (public domain)

Animated, skinned enemy models. Source: https://quaternius.com, downloaded via https://poly.pizza.

| File | Original model |
| --- | --- |
| `e_rust_grunt.glb` | Robot Enemy |
| `e_rust_brute.glb` | Robot Enemy Large |
| `e_rust_tank.glb` | Robot Enemy Large Gun (also used for the Warlord boss) |
| `e_rust_flyer.glb` | Robot Enemy Flying Gun |
| `e_spider.glb` | Spider |
| `e_glim_tank.glb` | Crab Enemy |
| `e_glim_brute.glb` | Alien |
| `e_glim_flyer.glb` | Glub Evolved |
| `e_glim_boss.glb` | Dragon Evolved |

The materials are replaced at runtime with the game's rust-armour and glim-crystal PBR palettes, including emissive eyes and a fresnel rim.

## Libraries

- [three.js](https://threejs.org) r169 (MIT), including its GLTFLoader, KTX2Loader with the Basis transcoder, and the meshopt decoder.
