export const clamp8 = v => v<0?0:v>255?255:v;
export const idx = (x,y,W) => y*W+x;

export function pickWeighted(weights){
  let total = 0; for (const x of weights) total += x.w;
  let r = Math.random()*total;
  for (const x of weights){ if ((r-=x.w)<=0) return x.t; }
  return weights.at(-1)?.t ?? null;
}

export function scaleRGB([r,g,b], s){
  return [clamp8((r*s)|0), clamp8((g*s)|0), clamp8((b*s)|0)];
}

export function mixRGB(a,b, t=0.5){
  const u=1-t;
  return [
    clamp8((a[0]*u + b[0]*t)|0),
    clamp8((a[1]*u + b[1]*t)|0),
    clamp8((a[2]*u + b[2]*t)|0),
  ];
}
