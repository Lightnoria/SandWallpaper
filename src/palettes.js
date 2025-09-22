import { clamp8 } from './utils.js';

const sandPalette    = [[220,185,70],[210,175,65],[200,168,60],[190,160,55]];
const rockPalette    = [[165,145,105],[158,138,100],[172,152,112]];
const crystalPalette = [[140,220,255],[120,205,245],[160,235,255]];

function jitter([r,g,b], a){
  return [clamp8(r+((Math.random()*2-1)*a)|0),
          clamp8(g+((Math.random()*2-1)*a)|0),
          clamp8(b+((Math.random()*2-1)*a)|0)];
}

export const pickSand    = () => jitter(sandPalette[(Math.random()*sandPalette.length)|0], 6);
export const pickRock    = () => jitter(rockPalette[(Math.random()*rockPalette.length)|0], 5);
export const pickCrystal = () => jitter(crystalPalette[(Math.random()*crystalPalette.length)|0], 4);
