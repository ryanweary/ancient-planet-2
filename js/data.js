// Ancient Planet II: Return to Hamal — game data (original fan sequel)
export const GW = 9, GH = 15;

// Races: Rustborn (mechanical) and Glimmerkin (crystalline energy beings)
export const RACES = {
  rust: { name: 'Rustborn', color: 0xc8502a, accent: 0xffb040, desc: 'Scrap-iron war machines. Weak to Machine Guns, resist Energy.' },
  glim: { name: 'Glimmerkin', color: 0x32d0b0, accent: 0xb0ff60, desc: 'Living crystal swarms. Weak to Energy, resist Machine Guns.' },
};

export const ENEMIES = {
  grunt: { name: 'Trooper', hp: 40, speed: 0.9, armor: 0, gold: 4, dmg: 1, r: 0.22 },
  swarm: { name: 'Skitter', hp: 15, speed: 1.6, armor: 0, gold: 2, dmg: 1, r: 0.16 },
  tank:  { name: 'Crawler Tank', hp: 170, speed: 0.55, armor: 4, gold: 10, dmg: 2, r: 0.32 },
  flyer: { name: 'Glider', hp: 48, speed: 1.1, armor: 0, gold: 6, dmg: 1, air: true, r: 0.26 },
  brute: { name: 'Juggernaut', hp: 420, speed: 0.6, armor: 2, gold: 22, dmg: 3, r: 0.38 },
  boss:  { name: 'Warlord', hp: 2600, speed: 0.38, armor: 6, gold: 120, dmg: 10, r: 0.55, boss: true },
  healer: { name: 'Mender', hp: 70, speed: 0.85, armor: 0, gold: 8, dmg: 1, r: 0.24, desc: 'Pulses repair energy that heals nearby enemies. Kill it first.' },
  shield: { name: 'Bulwark', hp: 130, speed: 0.7, armor: 1, gold: 10, dmg: 2, r: 0.3, desc: 'Projects a barrier: enemies near it take 30% less damage.' },
  splitter: { name: 'Hive Carrier', hp: 150, speed: 0.72, armor: 1, gold: 6, dmg: 2, r: 0.32, desc: 'Bursts into 3 Skitters when destroyed.' },
  phantom: { name: 'Wraith', hp: 55, speed: 1.15, armor: 0, gold: 7, dmg: 1, r: 0.22, desc: 'Cloaks every few seconds. Towers cannot target it unless an Amplifier is near.' },
};
// first level each enemy type can appear in waves
export const ENEMY_UNLOCK = { grunt: 0, swarm: 0, tank: 2, flyer: 3, boss: 4, brute: 6, healer: 9, shield: 13, splitter: 17, phantom: 21 };

// Warlord abilities by world (endless mode mixes them)
export const BOSS_ABIL = [['summon'], ['heal'], ['shield'], ['cloak', 'summon'], ['emp'], ['haste', 'shield'], ['emp', 'summon'], ['shield', 'emp', 'summon']];
export const ABIL_TEXT = { summon: 'calls Skitter swarms', heal: 'heals itself and its troops', shield: 'raises barriers when wounded', cloak: 'cloaks from your towers', emp: 'EMP-stuns nearby towers', haste: 'charges forward in bursts' };

// Level twists: rule changes that make each level play differently
export const TWISTS = {
  fog: { name: 'Dense Fog', icon: '☁', desc: 'Tower range −15%.' },
  goldrush: { name: 'Gold Rush', icon: '$', desc: 'Factory coins +60%, but start with 25% less gold.' },
  armored: { name: 'Armored Column', icon: '⛨', desc: 'Every enemy has +2 armor.' },
  swift: { name: 'Swift Assault', icon: '»', desc: 'Enemies move 25% faster but have 15% less health.' },
  storm: { name: 'Ion Storm', icon: 'ϟ', desc: 'Lightning knocks a random tower offline for 4s every so often.' },
  supply: { name: 'Supply Drops', icon: '▣', desc: 'Crates fall from orbit. Tap them for gold.' },
  regen: { name: 'Regeneration', icon: '✚', desc: 'Enemies heal when they go 2s without being hit.' },
  bounty: { name: 'Bounty Hunt', icon: '☠', desc: 'No Ore Factories, but kills pay 80% more gold and you start with 35% more.' },
  airraid: { name: 'Air Raid', icon: '✈', desc: 'Extra Glider squadrons join the attack.' },
  horde: { name: 'Horde', icon: '⁂', desc: 'Twice as many enemies, each with half the health.' },
  scarce: { name: 'Scarce Ground', icon: '▦', desc: 'You can build at most 10 combat towers.' },
};

// Tower definitions. levels[0] = built, levels[1..2] = upgrades, then pick a branch with 2 more levels.
export const TOWERS = {
  gun: {
    name: 'Machine Gun', cost: 45, ground: true, air: true, strong: 'rust', weak: 'glim', proj: 'bullet',
    desc: 'Rapid bullets. Shreds Rustborn, hits fliers. Weak vs armor.',
    levels: [{ dmg: 5, rate: 4, range: 2.6 }, { cost: 60, dmg: 8, rate: 4.5, range: 2.7 }, { cost: 110, dmg: 12, rate: 5, range: 2.9 }],
    branches: [
      { name: 'Gatling', desc: 'Rotary barrels, huge fire rate', levels: [{ cost: 150, dmg: 13, rate: 9, range: 3.0 }, { cost: 210, dmg: 17, rate: 12, range: 3.1 }] },
      { name: 'Rail Piercer', desc: 'Slugs that punch through armor', levels: [{ cost: 150, dmg: 34, rate: 3, range: 3.2, pierce: 0.6 }, { cost: 210, dmg: 50, rate: 3.2, range: 3.4, pierce: 1 }] },
    ],
  },
  energy: {
    name: 'Energy Crystal', cost: 60, ground: true, air: false, strong: 'glim', weak: 'rust', proj: 'lob',
    desc: 'Lobs splashing plasma. Melts Glimmerkin. Ground only.',
    levels: [{ dmg: 18, rate: 0.9, range: 2.8, splash: 0.9 }, { cost: 60, dmg: 28, rate: 0.95, range: 2.9, splash: 0.95 }, { cost: 110, dmg: 42, rate: 1.0, range: 3.0, splash: 1.1 }],
    branches: [
      { name: 'Twin Lob', desc: 'Fires two plasma shells', levels: [{ cost: 150, dmg: 46, rate: 1.0, range: 3.1, splash: 1.1, multi: 2 }, { cost: 210, dmg: 58, rate: 1.1, range: 3.2, splash: 1.2, multi: 2 }] },
      { name: 'Fusion Core', desc: 'Massive slow blasts', levels: [{ cost: 150, dmg: 110, rate: 0.7, range: 3.2, splash: 1.4 }, { cost: 210, dmg: 155, rate: 0.72, range: 3.4, splash: 1.6 }] },
    ],
  },
  cryo: {
    name: 'Cryogen', cost: 40, ground: true, air: true, proj: 'beam',
    desc: 'Freezing beam slows enemies. Hits fliers.',
    levels: [{ dps: 4, slow: 0.35, range: 2.4 }, { cost: 55, dps: 7, slow: 0.42, range: 2.5 }, { cost: 100, dps: 11, slow: 0.48, range: 2.6 }],
    branches: [
      { name: 'Deep Freeze', desc: 'Near-total slow', levels: [{ cost: 140, dps: 15, slow: 0.62, range: 2.8 }, { cost: 190, dps: 20, slow: 0.72, range: 3.0 }] },
      { name: 'Frost Chain', desc: 'Beam forks to more targets', levels: [{ cost: 140, dps: 17, slow: 0.5, range: 2.8, chain: 2 }, { cost: 190, dps: 24, slow: 0.52, range: 3.0, chain: 3 }] },
    ],
  },
  missile: {
    name: 'Rocket Battery', cost: 90, ground: true, air: true, proj: 'missile', advanced: true,
    desc: 'Long-range splash salvos. Great vs fliers and crowds.',
    levels: [{ dmg: 20, rate: 0.5, range: 3.6, splash: 0.8, multi: 3 }, { cost: 90, dmg: 26, rate: 0.52, range: 3.7, splash: 0.85, multi: 3 }, { cost: 140, dmg: 32, rate: 0.55, range: 3.8, splash: 0.9, multi: 4 }],
    branches: [
      { name: 'Barrage', desc: 'Huge salvos', levels: [{ cost: 190, dmg: 34, rate: 0.55, range: 4.0, splash: 0.9, multi: 6 }, { cost: 250, dmg: 40, rate: 0.6, range: 4.2, splash: 1.0, multi: 8 }] },
      { name: 'Hellfire', desc: 'Heavy warheads', levels: [{ cost: 190, dmg: 75, rate: 0.55, range: 4.0, splash: 1.2, multi: 3 }, { cost: 250, dmg: 100, rate: 0.6, range: 4.3, splash: 1.3, multi: 3 }] },
    ],
  },
  naval: {
    name: 'Tide Cannon', cost: 85, ground: true, air: false, proj: 'shell', advanced: true, water: true,
    desc: 'Built on water only. Huge range, heavy shells.',
    levels: [{ dmg: 70, rate: 0.6, range: 4.2, splash: 0.6 }, { cost: 90, dmg: 100, rate: 0.62, range: 4.4, splash: 0.65 }, { cost: 140, dmg: 140, rate: 0.65, range: 4.6, splash: 0.7 }],
    branches: [
      { name: 'Broadside', desc: 'Rapid triple shots', levels: [{ cost: 190, dmg: 110, rate: 1.4, range: 4.8, splash: 0.7 }, { cost: 250, dmg: 140, rate: 1.6, range: 5.0, splash: 0.75 }] },
      { name: 'Dreadnought', desc: 'Colossal shells', levels: [{ cost: 190, dmg: 320, rate: 0.6, range: 5.0, splash: 1.0 }, { cost: 250, dmg: 440, rate: 0.62, range: 5.4, splash: 1.1 }] },
    ],
  },
  reaper: {
    name: 'Soul Reaper', cost: 110, ground: true, air: true, proj: 'chain', advanced: true,
    desc: 'Chain lightning arcs between foes. Kills grant bonus gold.',
    levels: [{ dmg: 30, rate: 1.1, range: 2.6, chain: 3 }, { cost: 100, dmg: 42, rate: 1.15, range: 2.7, chain: 3 }, { cost: 150, dmg: 56, rate: 1.2, range: 2.8, chain: 4 }],
    branches: [
      { name: 'Tempest', desc: 'Arcs to many more foes', levels: [{ cost: 200, dmg: 64, rate: 1.25, range: 3.0, chain: 6 }, { cost: 260, dmg: 76, rate: 1.3, range: 3.1, chain: 8 }] },
      { name: 'Harvester', desc: 'Brutal arcs, more soul gold', levels: [{ cost: 200, dmg: 120, rate: 1.2, range: 3.0, chain: 3, soul: 2 }, { cost: 260, dmg: 165, rate: 1.25, range: 3.2, chain: 4, soul: 3 }] },
    ],
  },
  destroyer: {
    name: 'Armor Destroyer', cost: 100, ground: true, air: false, proj: 'bolt', advanced: true,
    desc: 'Ignores armor. Double damage to tanks and bosses.',
    levels: [{ dmg: 90, rate: 0.55, range: 3.0, pierce: 1 }, { cost: 100, dmg: 130, rate: 0.57, range: 3.1, pierce: 1 }, { cost: 150, dmg: 180, rate: 0.6, range: 3.2, pierce: 1 }],
    branches: [
      { name: 'Autoloader', desc: 'Much faster reloads', levels: [{ cost: 200, dmg: 200, rate: 1.0, range: 3.3, pierce: 1 }, { cost: 260, dmg: 240, rate: 1.25, range: 3.4, pierce: 1 }] },
      { name: 'Siege Lance', desc: 'Enormous single hits', levels: [{ cost: 200, dmg: 480, rate: 0.55, range: 3.6, pierce: 1 }, { cost: 260, dmg: 680, rate: 0.57, range: 3.9, pierce: 1 }] },
    ],
  },
  support: {
    name: 'Amplifier', cost: 30, core: 1, proj: 'none', support: true,
    desc: 'Boosts nearby towers. Costs 1 Core + gold.',
    levels: [{ boost: 0.15, range: 1.6 }, { cost: 60, boost: 0.22, range: 1.7 }, { cost: 110, boost: 0.28, range: 1.8 }],
    branches: [
      { name: 'Overclock', desc: '+Fire rate to neighbors', levels: [{ cost: 150, boost: 0.3, rateB: 0.2, range: 1.9 }, { cost: 200, boost: 0.32, rateB: 0.32, range: 2.0 }] },
      { name: 'Optics', desc: '+Range to neighbors', levels: [{ cost: 150, boost: 0.3, rangeB: 0.15, range: 1.9 }, { cost: 200, boost: 0.32, rangeB: 0.25, range: 2.0 }] },
    ],
  },
  factory: {
    name: 'Ore Factory', cost: 40, proj: 'none', deposit: true,
    desc: 'Build on glowing deposits. Tap the coins it makes!',
    levels: [{ coin: 15, every: 14 }, { cost: 50, coin: 20, every: 13 }, { cost: 80, coin: 25, every: 12 }],
    branches: null,
  },
};
export const TOWER_ORDER = ['factory', 'gun', 'energy', 'cryo', 'missile', 'naval', 'reaper', 'destroyer', 'support'];

export const POWERS = {
  block:  { name: 'Barricade', charges: 2, cd: 20, desc: 'Drop a concrete block on the road. Ground foes must smash it.', target: 'path' },
  mines:  { name: 'Minefield', charges: 2, cd: 18, desc: 'Explosive mines on the road. Fliers pass over.', target: 'path' },
  freeze: { name: 'Stasis Pulse', charges: 1, cd: 40, desc: 'Freezes every enemy for 4 seconds.', target: 'none' },
  strike: { name: 'Orbital Lance', charges: 1, cd: 35, desc: 'A death ray from orbit. Tap anywhere.', target: 'any' },
};
export const POWER_ORDER = ['block', 'mines', 'freeze', 'strike'];

// Unlock schedule (level index where it becomes available)
export const UNLOCKS = {
  tower: { gun: 0, cryo: 0, factory: 0, energy: 1, support: 5, missile: 7, naval: 10, reaper: 15, destroyer: 20 },
  power: { block: 3, mines: 6, freeze: 11, strike: 16 },
};

// Meta (emerald) upgrades
export const PERKS = {
  gun: [['gun_crit', 'Hollow Points', '15% chance to crit for 2.5× damage'], ['gun_tracer', 'Tracer Rounds', 'Sees cloaked Wraiths, +25% damage to fliers']],
  energy: [['energy_burn', 'Plasma Burn', 'Splash sets ground on fire: 30% extra damage over 2s'], ['energy_over', 'Overcharge', 'Every 3rd shell deals double damage']],
  cryo: [['cryo_brittle', 'Brittle', 'Slowed enemies take +15% damage from every tower'], ['cryo_perma', 'Permafrost', 'Slow lingers 1.5s after the beam stops']],
  missile: [['missile_cluster', 'Cluster Warheads', '+35% splash radius'], ['missile_aa', 'Flak Seekers', '+40% damage to fliers']],
  naval: [['naval_concuss', 'Concussion', 'Shells knock ground enemies back'], ['naval_shrap', 'Shrapnel', '+40% splash radius']],
  reaper: [['reaper_static', 'Static Field', 'Arcs slow enemies by 30% for 1s'], ['reaper_tithe', 'Grim Tithe', '+2 soul gold per kill']],
  destroyer: [['destroyer_shred', 'Armor Shred', 'Each hit strips 2 armor and breaks shields'], ['destroyer_exec', 'Executioner', 'Double damage to enemies under 30% health']],
};
function towerNodes(k) {
  const pk = PERKS[k] || [];
  return [
    { id: k + '_dmg1', name: 'Damage I', cost: 15, eff: { dmg: 0.1 }, desc: '+10% damage' },
    { id: k + '_dmg2', name: 'Damage II', cost: 35, eff: { dmg: 0.12 }, desc: '+12% damage', req: k + '_dmg1' },
    { id: k + '_rng', name: 'Range', cost: 30, eff: { range: 0.1 }, desc: '+10% range', req: k + '_dmg1' },
    { id: k + '_cost', name: 'Discount', cost: 40, eff: { cost: 0.1 }, desc: '-10% build cost', req: k + '_rng' },
    { id: k + '_dmg3', name: 'Damage III', cost: 70, eff: { dmg: 0.15 }, desc: '+15% damage', req: k + '_dmg2' },
    ...pk.map(([id, name, desc], i) => ({ id, name, cost: 60 + i * 25, eff: { perk: id }, desc, req: i ? k + '_dmg2' : k + '_rng', perk: true })),
  ];
}
export const META = {
  towers: Object.fromEntries(['gun', 'energy', 'cryo', 'missile', 'naval', 'reaper', 'destroyer'].map(k => [k, towerNodes(k)])
    .concat([['factory', [
      { id: 'factory_v1', name: 'Rich Ore I', cost: 20, eff: { coin: 0.15 }, desc: '+15% coin value' },
      { id: 'factory_v2', name: 'Rich Ore II', cost: 45, eff: { coin: 0.2 }, desc: '+20% coin value', req: 'factory_v1' },
      { id: 'factory_mag', name: 'Coin Magnet', cost: 60, eff: { magnet: 1 }, desc: 'Coins collect themselves after 3s', req: 'factory_v1' },
      { id: 'factory_veins', name: 'Deep Veins', cost: 70, eff: { perk: 'factory_veins' }, desc: 'Factories mint coins 2s faster', req: 'factory_v2', perk: true },
    ]], ['support', [
      { id: 'support_b1', name: 'Resonance I', cost: 25, eff: { boost: 0.05 }, desc: '+5% boost' },
      { id: 'support_b2', name: 'Resonance II', cost: 55, eff: { boost: 0.07 }, desc: '+7% boost', req: 'support_b1' },
      { id: 'support_jam', name: 'Jammer', cost: 60, eff: { perk: 'support_jam' }, desc: 'Enemies in range move 15% slower', req: 'support_b1', perk: true },
      { id: 'support_break', name: 'Shield Breaker', cost: 85, eff: { perk: 'support_break' }, desc: 'Boosted towers ignore Bulwark barriers and deal +50% to shields', req: 'support_b2', perk: true },
    ]]])),
  weapon: Object.fromEntries(POWER_ORDER.map(k => [k, [
    { id: k + '_c1', name: 'Extra Charge', cost: 25, eff: { charges: 1 }, desc: '+1 charge per battle' },
    { id: k + '_p1', name: 'Potency I', cost: 30, eff: { pot: 0.3 }, desc: '+30% power', req: k + '_c1' },
    { id: k + '_cd', name: 'Quick Cycle', cost: 40, eff: { cd: 0.3 }, desc: '-30% cooldown', req: k + '_p1' },
    { id: k + '_c2', name: 'Extra Charge II', cost: 60, eff: { charges: 1 }, desc: '+1 charge per battle', req: k + '_cd' },
  ]])),
  base: {
    gate: [
      { id: 'gate1', name: 'Gate Plating I', cost: 20, eff: { life: 3 }, desc: '+3 base life' },
      { id: 'gate2', name: 'Gate Plating II', cost: 40, eff: { life: 3 }, desc: '+3 base life', req: 'gate1' },
      { id: 'gate3', name: 'Gate Plating III', cost: 80, eff: { life: 4 }, desc: '+4 base life', req: 'gate2' },
    ],
    gun: [
      { id: 'bgun1', name: 'Base Turret I', cost: 30, eff: { bgun: 1 }, desc: 'The temple gets a defense gun' },
      { id: 'bgun2', name: 'Base Turret II', cost: 60, eff: { bgun: 1 }, desc: 'Stronger temple gun', req: 'bgun1' },
      { id: 'bgun3', name: 'Base Turret III', cost: 110, eff: { bgun: 1 }, desc: 'Devastating temple gun', req: 'bgun2' },
    ],
    dome: [
      { id: 'dome1', name: 'Energy Dome I', cost: 35, eff: { dome: 2 }, desc: 'Shield absorbs 2 hits per battle' },
      { id: 'dome2', name: 'Energy Dome II', cost: 70, eff: { dome: 2 }, desc: 'Absorbs +2 hits', req: 'dome1' },
      { id: 'dome3', name: 'Energy Dome III', cost: 120, eff: { dome: 3 }, desc: 'Absorbs +3 hits', req: 'dome2' },
    ],
    treasury: [
      { id: 'tres1', name: 'War Chest I', cost: 25, eff: { gold: 0.08 }, desc: '+8% starting gold' },
      { id: 'tres2', name: 'War Chest II', cost: 50, eff: { gold: 0.08 }, desc: '+8% starting gold', req: 'tres1' },
      { id: 'tres3', name: 'War Chest III', cost: 90, eff: { gold: 0.1 }, desc: '+10% starting gold', req: 'tres2' },
      { id: 'bank1', name: 'Interest', cost: 70, eff: { interest: 0.03 }, desc: '+3% interest on banked gold at each wave (max 30)', req: 'tres1' },
    ],
    salvage: [
      { id: 'salv1', name: 'Salvage I', cost: 30, eff: { sell: 0.15 }, desc: 'Selling refunds 65%' },
      { id: 'salv2', name: 'Salvage II', cost: 60, eff: { sell: 0.15 }, desc: 'Selling refunds 80%', req: 'salv1' },
      { id: 'mend1', name: 'Temple Mending', cost: 110, eff: { mend: 1 }, desc: 'Regain 1 life after each wave you start with no leaks in the previous one', req: 'salv1' },
    ],
  },
};
export function allMetaNodes() {
  const out = [];
  for (const tab of ['towers', 'weapon', 'base']) for (const g in META[tab]) for (const n of META[tab][g]) out.push({ ...n, tab, group: g });
  return out;
}
export function metaEffects(owned) {
  const e = { tower: {}, power: {}, life: 0, bgun: 0, dome: 0, gold: 0, coin: 0, magnet: 0, boost: 0, perks: {}, sell: 0, interest: 0, mend: 0 };
  for (const n of allMetaNodes()) {
    if (!owned[n.id]) continue;
    if (n.eff.perk) { e.perks[n.eff.perk] = 1; continue; }
    if (n.tab === 'towers' && n.group !== 'factory' && n.group !== 'support') {
      const t = e.tower[n.group] || (e.tower[n.group] = { dmg: 0, range: 0, cost: 0 });
      for (const k in n.eff) t[k] += n.eff[k];
    } else if (n.tab === 'weapon') {
      const p = e.power[n.group] || (e.power[n.group] = { charges: 0, pot: 0, cd: 0 });
      for (const k in n.eff) p[k] += n.eff[k];
    } else for (const k in n.eff) e[k] += n.eff[k];
  }
  return e;
}

export const WORLDS = [
  { name: 'Verdant Rim', biome: 'verdant', blurb: 'The green cliffs where the old temples sleep.' },
  { name: 'Crystal Reef', biome: 'reef', blurb: 'Tidal flats studded with singing crystal.' },
  { name: 'Frostfang Caverns', biome: 'frost', blurb: 'Ice caves under a frozen sea.' },
  { name: 'Mire of Echoes', biome: 'mire', blurb: 'A glowing swamp that whispers back.' },
  { name: 'Ember Forge', biome: 'forge', blurb: 'Volcanic foundries of the Rustborn.' },
  { name: 'Skyshard Ruins', biome: 'sky', blurb: 'Temples adrift above the clouds.' },
  { name: 'Storm Plateau', biome: 'storm', blurb: 'Lightning-scarred highlands.' },
  { name: 'Hamal Prime', biome: 'city', blurb: 'The alien megacity at the heart of it all.' },
];

export const STORY = [
  // shown before world i
  [{ who: 'Commander Ottoline Vex', text: 'Good news, cadet: the Ancient Planet is saved! Bad news: someone left the back door open. Hamal sent everyone.' },
   { who: 'Engineer Nib', text: 'I rebuilt the temple guns from spare parts and optimism. Mostly optimism. Tap a glowing deposit to build a factory!' }],
  [{ who: 'Viceroy Gorbin Plume', text: 'Citizens of the reef! Your crystals have been selected for Voluntary Mandatory Liberation. Paperwork to follow.' },
   { who: 'Commander Ottoline Vex', text: 'He says that every time. Nib, unpack the rocket batteries.' }],
  [{ who: 'Engineer Nib', text: 'The caves have water! I built a cannon that floats. Please do not ask how. I do not know how.' },
   { who: 'Commander Ottoline Vex', text: 'Put Tide Cannons on water tiles. Keep the Glimmerkin cold and the Rustborn colder.' }],
  [{ who: 'Viceroy Gorbin Plume', text: 'The swamp campaign is going splendidly. I have awarded myself the Medal of Swamp Splendor, Third Class.' },
   { who: 'Engineer Nib', text: 'New toy: the Soul Reaper. Lightning that jumps between enemies and politely returns their pocket change.' }],
  [{ who: 'Commander Ottoline Vex', text: 'This is the Ember Forge. Every Rustborn tank on the planet was built here.' },
   { who: 'Engineer Nib', text: 'So I built an Armor Destroyer. It does not care how thick your plating is. It has no feelings. I gave them all to the Gatling.' }],
  [{ who: 'Viceroy Gorbin Plume', text: 'Our floating temples are a gift to the galaxy. Admission is one planet per visitor.' },
   { who: 'Commander Ottoline Vex', text: 'Watch the edges, cadet. It is a long way down, and the paperwork is worse.' }],
  [{ who: 'Engineer Nib', text: 'The Storm Plateau charges my towers for free. It also charges me. Ow.' },
   { who: 'Viceroy Gorbin Plume', text: 'Surrender now and receive a complimentary commemorative mug. The mug is also a bomb.' }],
  [{ who: 'Commander Ottoline Vex', text: 'Hamal Prime. Their capital. We end this here, and then I am taking a very long nap.' },
   { who: 'Viceroy Gorbin Plume', text: 'You cannot defeat me! I have a cape. Several capes. A cape committee.' }],
];
export const ENDING = [
  { who: 'Viceroy Gorbin Plume', text: 'Fine! FINE. I hereby declare this defeat a strategic victory, and I am leaving to celebrate it somewhere far away.' },
  { who: 'Engineer Nib', text: 'I kept one of his capes. It makes an excellent tower cozy.' },
  { who: 'Commander Ottoline Vex', text: 'Well fought, cadet. The Ancient Planet is safe. Again. Nap time.' },
];
