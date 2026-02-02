// Simple ASCII banners for AIgile installer output (ESM)

export const AIGILE_TITLE = 'AIgile-Method';
export const INSTALLER_TITLE = 'INSTALLER';

export const AIGILE_LARGE = `
 █████╗ ██╗ ██████╗ ██╗██╗     ███████╗    ██╗███╗   ██╗███████╗████████╗ █████╗ ██╗     ██╗     ███████╗██████╗ 
██╔══██╗██║██╔════╝ ██║██║     ██╔════╝    ██║████╗  ██║██╔════╝╚══██╔══╝██╔══██╗██║     ██║     ██╔════╝██╔══██╗
███████║██║██║  ███╗██║██║     █████╗      ██║██╔██╗ ██║███████╗   ██║   ███████║██║     ██║     █████╗  ██████╔╝
██╔══██║██║██║   ██║██║██║     ██╔══╝      ██║██║╚██╗██║╚════██║   ██║   ██╔══██║██║     ██║     ██╔══╝  ██╔══██╗
██║  ██║██║╚██████╔╝██║███████╗███████╗    ██║██║ ╚████║███████║   ██║   ██║  ██║███████╗███████╗███████╗██║  ██║
╚═╝  ╚═╝╚═╝ ╚═════╝ ╚═╝╚══════╝╚══════╝    ╚═╝╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝
                                                                                                                
`;

export const INSTALLER_SMALL = `
╭──────────────────────────╮
│     AIgile Installer     │
╰──────────────────────────╯
`;

// GM signature banners
export const GM_LARGE = `
 ██████╗██████╗ ███████╗ █████╗ ████████╗███████╗██████╗     ██████╗ ██╗   ██╗     ██████╗ ███╗   ███╗
██╔════╝██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██╔════╝██╔══██╗    ██╔══██╗╚██╗ ██╔╝    ██╔════╝ ████╗ ████║
██║     ██████╔╝█████╗  ███████║   ██║   █████╗  ██║  ██║    ██████╔╝ ╚████╔╝     ██║  ███╗██╔████╔██║
██║     ██╔══██╗██╔══╝  ██╔══██║   ██║   ██╔══╝  ██║  ██║    ██╔══██╗  ╚██╔╝      ██║   ██║██║╚██╔╝██║
╚██████╗██║  ██║███████╗██║  ██║   ██║   ███████╗██████╔╝    ██████╔╝   ██║       ╚██████╔╝██║ ╚═╝ ██║
 ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═════╝     ╚═════╝    ╚═╝        ╚═════╝ ╚═╝     ╚═╝
                                                                                                      
`;
export const GM_MEDIUM = `
╭──────────────────────────╮
│     Created by GM        │
╰──────────────────────────╯
`;

function applyGradient(text, startColor, endColor) {
  const length = text.length;
  let result = '';

  for (let i = 0; i < length; i++) {
    const char = text[i];
    if (char === '\n') {
      result += char;
      continue;
    }
    const ratio = i / length;
    const r = Math.round(startColor.r + ratio * (endColor.r - startColor.r));
    const g = Math.round(startColor.g + ratio * (endColor.g - startColor.g));
    const b = Math.round(startColor.b + ratio * (endColor.b - startColor.b));
    result += `\x1b[38;2;${r};${g};${b}m${char}\x1b[0m`;
  }

  return result;
}

export function printInstallBanner({ showGMSignature = true } = {}) {
  const neonGreen = { r: 57, g: 255, b: 20 };     // Neon green
  const cyan = { r: 0, g: 255, b: 255 };          // Cyan
  const magenta = { r: 255, g: 0, b: 255 };       // Magenta
  const orange = { r: 255, g: 165, b: 0 };        // Orange

  console.log('\n' + applyGradient(AIGILE_LARGE, neonGreen, cyan));
  if (showGMSignature) {
    console.log(applyGradient(GM_LARGE, magenta, orange));
  }
}
