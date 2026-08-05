import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const outputRoot = path.join(projectRoot, "apps/web/public/visual-assets/library");

const palettes = [
  ["#f7f2e8", "#8fb8a3", "#365c54", "#e7b66b", "#ffffff"],
  ["#f5f8e9", "#8dbf73", "#3f7554", "#efc86a", "#ffffff"],
  ["#fff5ed", "#d8322f", "#8f171a", "#e5b75b", "#ffffff"],
  ["#edf7ff", "#2386d8", "#174a84", "#79d4e8", "#ffffff"],
  ["#fff7e6", "#ed8a34", "#9c3326", "#e8bd55", "#ffffff"],
  ["#f0fbff", "#46b8e9", "#ff806e", "#ffd359", "#ffffff"],
  ["#fff4f3", "#e88b9f", "#a95a70", "#f3c86c", "#ffffff"],
  ["#faf9f6", "#242424", "#ef7049", "#b9b9b9", "#ffffff"],
  ["#f6f7f2", "#658799", "#415a63", "#8eae80", "#ffffff"],
  ["#0f2540", "#d4ad63", "#f0d99a", "#416484", "#ffffff"],
];

const functions = [
  "background",
  "hero",
  "heading",
  "divider",
  "frame",
  "corner",
  "badge",
  "ribbon",
  "gallery",
  "sticker",
];

const effects = [
  "float",
  "pulse",
  "shimmer",
  "orbit",
  "wave",
  "falling-leaves",
  "twinkle",
  "reveal",
  "marquee",
  "breathe",
];

const serial = (value) => String(value).padStart(3, "0");

function defs(index, palette) {
  return `<defs>
    <linearGradient id="g${index}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette[1]}"/><stop offset="1" stop-color="${palette[2]}"/></linearGradient>
    <linearGradient id="fade${index}" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${palette[1]}" stop-opacity="0"/><stop offset=".5" stop-color="${palette[1]}" stop-opacity=".65"/><stop offset="1" stop-color="${palette[1]}" stop-opacity="0"/></linearGradient>
    <pattern id="dots${index}" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="2" fill="${palette[2]}" opacity=".16"/></pattern>
    <filter id="soft${index}"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>`;
}

function styleMotif(styleIndex, palette) {
  const [, primary, deep, accent] = palette;
  switch (styleIndex) {
    case 0:
      return `<path d="M0 360 Q160 250 310 330 T610 300 T910 325 T1200 260 V480H0Z" fill="${primary}" opacity=".28"/><path d="M0 405 Q220 300 420 390 T820 350 T1200 330 V480H0Z" fill="${deep}" opacity=".18"/><path d="M950 75q80 58 155 0" fill="none" stroke="${accent}" stroke-width="5" opacity=".6"/><circle cx="1020" cy="88" r="28" fill="${accent}" opacity=".42"/>`;
    case 1:
      return `<path d="M95 420C130 260 230 170 330 70M140 340c-65-85-115-54-96 20M205 230c82-65 132-30 91 38" fill="none" stroke="${deep}" stroke-width="8" stroke-linecap="round" opacity=".5"/><g fill="${primary}" opacity=".55"><ellipse cx="90" cy="356" rx="55" ry="22" transform="rotate(35 90 356)"/><ellipse cx="215" cy="233" rx="68" ry="25" transform="rotate(-29 215 233)"/><ellipse cx="280" cy="130" rx="54" ry="21" transform="rotate(-38 280 130)"/></g><circle cx="1035" cy="105" r="52" fill="${accent}" opacity=".28"/>`;
    case 2:
      return `<path d="M0 0h440L260 210H0Z" fill="${deep}" opacity=".95"/><path d="M1200 480H760l185-205h255Z" fill="${primary}" opacity=".92"/><path d="M0 430C260 330 340 360 570 440" fill="none" stroke="${accent}" stroke-width="12" opacity=".55"/><g fill="${accent}"><path d="m995 72 8 24h25l-20 15 8 24-21-15-20 15 8-24-20-15h25Z"/><circle cx="1055" cy="190" r="8"/><circle cx="1090" cy="160" r="5"/></g>`;
    case 3:
      return `<path d="M0 400L360 110l205 165L805 52l395 320v108H0Z" fill="url(#g3)" opacity=".18"/><g fill="none" stroke="${primary}" opacity=".3"><circle cx="925" cy="185" r="115"/><circle cx="925" cy="185" r="72"/><path d="M760 185h330M925 20v330"/></g><g fill="${accent}"><circle cx="925" cy="70" r="9"/><circle cx="1038" cy="228" r="7"/><circle cx="822" cy="240" r="6"/></g>`;
    case 4:
      return `<circle cx="1035" cy="105" r="72" fill="${accent}" opacity=".7"/><path d="M820 0q55 95 0 190q-55-95 0-190Zm120 15q55 95 0 190q-55-95 0-190Z" fill="${primary}" opacity=".75"/><path d="M0 420q120-90 240 0t240 0 240 0 240 0 240 0v60H0Z" fill="${deep}" opacity=".19"/><path d="M0 445q120-90 240 0t240 0 240 0 240 0 240 0v35H0Z" fill="${primary}" opacity=".25"/>`;
    case 5:
      return `<path d="M95 105c30-72 125-72 155 0 72-35 132 45 77 101 55 56-5 136-77 101-30 72-125 72-155 0-72 35-132-45-77-101-55-56 5-136 77-101Z" fill="${accent}" opacity=".38"/><path d="M900 120c70-82 190-70 235 18" fill="none" stroke="${primary}" stroke-width="24" stroke-linecap="round" opacity=".65"/><g fill="${deep}" opacity=".45"><circle cx="970" cy="92" r="13"/><circle cx="1090" cy="130" r="17"/><circle cx="1020" cy="175" r="9"/></g>`;
    case 6:
      return `<path d="M0 390c155-115 310-75 430 15 120-125 300-115 405 4 120-105 245-90 365-10v81H0Z" fill="${primary}" opacity=".2"/><g fill="none" stroke="${deep}" stroke-width="6" opacity=".35"><path d="M118 130c0-50 70-70 92-20 23-50 93-30 93 20 0 53-93 112-93 112s-92-59-92-112Z"/><path d="M945 320c0-35 50-48 66-14 16-34 66-21 66 14 0 37-66 78-66 78s-66-41-66-78Z"/></g>`;
    case 7:
      return `<rect x="48" y="45" width="520" height="24" fill="${deep}"/><rect x="635" y="45" width="310" height="8" fill="${accent}"/><rect x="975" y="45" width="177" height="8" fill="${deep}" opacity=".28"/><circle cx="1035" cy="330" r="105" fill="${accent}" opacity=".17"/><path d="M0 410h1200" stroke="${deep}" stroke-width="2"/><path d="M560 0v480" stroke="${deep}" stroke-width="1" opacity=".12"/>`;
    case 8:
      return `<path d="M25 385c135-75 205-18 318-68 145-65 202 28 350-31 140-56 233 42 482-34" fill="none" stroke="${deep}" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 14" opacity=".42"/><path d="M170 95q70-58 135 0-65 42-135 0Zm740 22q58-55 120 2-60 43-120-2Z" fill="none" stroke="${primary}" stroke-width="6" opacity=".55"/><g fill="${accent}" opacity=".45"><circle cx="105" cy="120" r="7"/><circle cx="135" cy="95" r="4"/><circle cx="1080" cy="320" r="10"/></g>`;
    default:
      return `<rect width="1200" height="480" fill="url(#dots9)"/><path d="M0 0h250l-90 480H0Zm1200 0h-170l-85 480h255Z" fill="${primary}" opacity=".18"/><path d="M80 420h1040" stroke="${accent}" stroke-width="3"/><g fill="none" stroke="${accent}" opacity=".4"><circle cx="995" cy="115" r="64"/><circle cx="995" cy="115" r="48"/></g>`;
  }
}

function functionOverlay(assetFunction, palette, index) {
  const [, primary, deep, accent, white] = palette;
  switch (assetFunction) {
    case "background":
      return `<rect x="24" y="24" width="1152" height="432" rx="28" fill="none" stroke="${primary}" stroke-width="2" opacity=".22"/>`;
    case "hero":
      return `<rect x="300" y="118" width="600" height="244" rx="22" fill="${white}" opacity=".73"/><path d="M420 296h360" stroke="${accent}" stroke-width="6" stroke-linecap="round"/><circle cx="600" cy="175" r="18" fill="${primary}" opacity=".75"/>`;
    case "heading":
      return `<rect x="330" y="180" width="540" height="120" rx="60" fill="${white}" opacity=".82"/><path d="M270 240h-150m810 0h150" stroke="${primary}" stroke-width="5" stroke-linecap="round"/><circle cx="290" cy="240" r="8" fill="${accent}"/><circle cx="910" cy="240" r="8" fill="${accent}"/>`;
    case "divider":
      return `<path d="M115 240h370m230 0h370" stroke="${deep}" stroke-width="3" opacity=".5"/><path d="m600 190 50 50-50 50-50-50Z" fill="${primary}" opacity=".8"/><circle cx="600" cy="240" r="14" fill="${accent}"/>`;
    case "frame":
      return `<rect x="145" y="60" width="910" height="360" rx="26" fill="${white}" opacity=".45" stroke="${deep}" stroke-width="8"/><rect x="170" y="85" width="860" height="310" rx="18" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="12 12"/>`;
    case "corner":
      return `<path d="M70 180V70h110M1020 70h110v110M1130 300v110h-110M180 410H70V300" fill="none" stroke="${primary}" stroke-width="12" stroke-linecap="round"/><g fill="${accent}"><circle cx="70" cy="70" r="14"/><circle cx="1130" cy="70" r="14"/><circle cx="70" cy="410" r="14"/><circle cx="1130" cy="410" r="14"/></g>`;
    case "badge":
      return `<circle cx="600" cy="240" r="132" fill="${white}" opacity=".78" stroke="${primary}" stroke-width="8"/><circle cx="600" cy="240" r="104" fill="none" stroke="${accent}" stroke-width="3" stroke-dasharray="8 10"/><path d="m515 360 35-76 50 45 50-45 35 76" fill="${primary}" opacity=".75"/>`;
    case "ribbon":
      return `<path d="M180 150h840l-75 90 75 90H180l75-90Z" fill="${primary}" opacity=".88"/><path d="M255 175h690v130H255Z" fill="${white}" opacity=".78"/><circle cx="290" cy="240" r="10" fill="${accent}"/><circle cx="910" cy="240" r="10" fill="${accent}"/>`;
    case "gallery":
      return `<g transform="rotate(-4 345 240)"><rect x="170" y="105" width="350" height="270" rx="16" fill="${white}" stroke="${deep}" stroke-width="5"/><rect x="195" y="130" width="300" height="200" rx="8" fill="${primary}" opacity=".27"/></g><g transform="rotate(4 855 240)"><rect x="680" y="105" width="350" height="270" rx="16" fill="${white}" stroke="${deep}" stroke-width="5"/><rect x="705" y="130" width="300" height="200" rx="8" fill="${accent}" opacity=".25"/></g>`;
    default:
      return `<g transform="translate(${160 + (index % 4) * 230} 240) rotate(${index % 2 === 0 ? -8 : 8})"><path d="M0-90c50-55 135-22 140 45 65 18 68 110 6 138-18 68-112 73-140 13-68 13-108-68-61-118-22-70 60-119 105-78Z" fill="${white}" stroke="${primary}" stroke-width="7"/><path d="m30 8 24 24 55-65" fill="none" stroke="${accent}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }
}

function staticSvg(styleIndex, functionIndex, index) {
  const palette = palettes[styleIndex];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 480" role="img" aria-label="原创视觉素材 ${serial(index)}">
  ${defs(styleIndex, palette)}
  <rect width="1200" height="480" fill="${palette[0]}"/>
  ${styleMotif(styleIndex, palette)}
  ${functionOverlay(functions[functionIndex], palette, index)}
</svg>\n`;
}

function dynamicBody(effect, palette) {
  const [, primary, deep, accent, white] = palette;
  const bodies = {
    float: `<g class="motion"><circle cx="360" cy="230" r="94" fill="${primary}" opacity=".3"/><path d="M180 330q180-180 360 0t360 0 240 0" fill="none" stroke="${deep}" stroke-width="18" opacity=".45"/><circle cx="840" cy="150" r="38" fill="${accent}" opacity=".7"/></g>`,
    pulse: `<g class="motion" transform-origin="600px 240px"><circle cx="600" cy="240" r="150" fill="${primary}" opacity=".18"/><circle cx="600" cy="240" r="105" fill="none" stroke="${deep}" stroke-width="18"/><circle cx="600" cy="240" r="55" fill="${accent}"/></g>`,
    shimmer: `<rect x="90" y="105" width="1020" height="270" rx="34" fill="${primary}" opacity=".2"/><path class="motion" d="M-200 430 80 50h180L-20 430Z" fill="${white}" opacity=".7"/><path d="M180 330h840" stroke="${deep}" stroke-width="6" opacity=".35"/>`,
    orbit: `<g transform="translate(600 240)"><ellipse rx="330" ry="140" fill="none" stroke="${primary}" stroke-width="5" opacity=".45"/><ellipse rx="210" ry="95" fill="none" stroke="${deep}" stroke-width="3" opacity=".35"/><g class="motion"><circle cx="330" r="22" fill="${accent}"/><circle cx="-210" r="14" fill="${deep}"/></g><circle r="72" fill="${primary}" opacity=".65"/></g>`,
    wave: `<g class="motion"><path d="M-120 305q120-100 240 0t240 0 240 0 240 0 240 0 240 0v175H-120Z" fill="${primary}" opacity=".35"/><path d="M-120 360q120-95 240 0t240 0 240 0 240 0 240 0 240 0" fill="none" stroke="${deep}" stroke-width="12" opacity=".5"/></g>`,
    "falling-leaves": `<g class="motion" fill="${primary}"><path d="M250 40q100 45 18 135-82-40-18-135Z"/><path d="M570-20q110 45 25 145-95-40-25-145Z" opacity=".7"/><path d="M900 60q95 40 22 128-80-36-22-128Z" opacity=".5"/></g><path d="M0 420q250-90 500 0t700 0v60H0Z" fill="${deep}" opacity=".2"/>`,
    twinkle: `<g class="motion" fill="${accent}"><path d="m270 110 14 38 40 14-40 14-14 38-14-38-40-14 40-14Z"/><path d="m610 230 18 50 50 18-50 18-18 50-18-50-50-18 50-18Z"/><path d="m930 85 12 33 33 12-33 12-12 33-12-33-33-12 33-12Z"/></g><circle cx="600" cy="240" r="185" fill="${primary}" opacity=".12"/>`,
    reveal: `<g class="motion"><rect x="160" y="90" width="880" height="300" rx="40" fill="${primary}" opacity=".28"/><path d="M220 315 430 145l155 130 190-185 210 225Z" fill="${deep}" opacity=".45"/><circle cx="855" cy="145" r="45" fill="${accent}"/></g>`,
    marquee: `<g class="motion"><circle cx="80" cy="240" r="55" fill="${accent}"/><path d="M170 240h180" stroke="${primary}" stroke-width="28" stroke-linecap="round"/><rect x="390" y="170" width="210" height="140" rx="28" fill="${deep}" opacity=".6"/><path d="m690 155 120 85-120 85Z" fill="${primary}"/><circle cx="950" cy="240" r="80" fill="none" stroke="${accent}" stroke-width="18"/></g>`,
    breathe: `<g class="motion" transform-origin="600px 240px"><rect x="165" y="90" width="870" height="300" rx="150" fill="${primary}" opacity=".26"/><path d="M330 240h540" stroke="${deep}" stroke-width="10" stroke-linecap="round"/><circle cx="600" cy="240" r="74" fill="${accent}" opacity=".8"/></g>`,
  };
  return bodies[effect];
}

function dynamicCss(effect) {
  const animations = {
    float: "transform:translateY(-22px) rotate(2deg)",
    pulse: "transform:scale(1.12);opacity:.72",
    shimmer: "transform:translateX(1300px)",
    orbit: "transform:rotate(360deg)",
    wave: "transform:translateX(240px)",
    "falling-leaves": "transform:translate(90px,470px) rotate(210deg)",
    twinkle: "opacity:.2;transform:scale(.72)",
    reveal: "opacity:.15;transform:translateY(24px)",
    marquee: "transform:translateX(1160px)",
    breathe: "opacity:.55;transform:scale(.92)",
  };
  return `<style>.motion{animation:${effect} 4.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}@keyframes ${effect}{0%,100%{transform:none;opacity:1}50%{${animations[effect]}}}@media(prefers-reduced-motion:reduce){.motion{animation:none}}</style>`;
}

function dynamicSvg(styleIndex, effectIndex, index) {
  const palette = palettes[styleIndex];
  const effect = effects[effectIndex];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 480" role="img" aria-label="原创动态视觉素材 ${serial(index)}">
  ${dynamicCss(effect)}
  ${defs(20 + styleIndex, palette)}
  <rect width="1200" height="480" fill="${palette[0]}"/>
  <rect width="1200" height="480" fill="url(#dots${20 + styleIndex})"/>
  ${dynamicBody(effect, palette)}
</svg>\n`;
}

await mkdir(path.join(outputRoot, "static"), { recursive: true });
await mkdir(path.join(outputRoot, "dynamic"), { recursive: true });

const writes = [];
for (let styleIndex = 0; styleIndex < palettes.length; styleIndex += 1) {
  for (let functionIndex = 0; functionIndex < functions.length; functionIndex += 1) {
    const index = styleIndex * functions.length + functionIndex + 1;
    writes.push(
      writeFile(
        path.join(outputRoot, "static", `static-${serial(index)}.svg`),
        staticSvg(styleIndex, functionIndex, index),
        "utf8",
      ),
    );
  }
}
for (let styleIndex = 0; styleIndex < 5; styleIndex += 1) {
  for (let effectIndex = 0; effectIndex < effects.length; effectIndex += 1) {
    const index = styleIndex * effects.length + effectIndex + 1;
    writes.push(
      writeFile(
        path.join(outputRoot, "dynamic", `dynamic-${serial(index)}.svg`),
        dynamicSvg(styleIndex, effectIndex, index),
        "utf8",
      ),
    );
  }
}
await Promise.all(writes);
process.stdout.write(`Generated ${String(writes.length)} original visual assets.\n`);
