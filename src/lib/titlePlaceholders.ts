/** Hide Notion template slots & assignment tag hashtags in presentation only; preserve content hashtags & original title. */
export function stripTitlePlaceholders(value: string): string {
  const raw = String(value || '');
  return raw
    .replace(
      /(^|[\s|(\[\p{Extended_Pictographic}\uFE0F])#(?:ffase\d*|descripcion|descripción|tipo|dominio|plantilla[^\s|\])]*|[01pd]\.(?=[a-z0-9-]*[a-z][a-z0-9-]*\.)[^\s|\])]+|(?:nne|gge|aac|kka|jjo|iis|aan|bbr|sso|eed|nn-e|gg-e|aa-c|kk-a|jj-o|ii-s|aa-n|bb-r|ss-o|ee-d|nneft|nnetf|ggena|aacal|kkarl|jjohn|iisai|aandr|bbria|ssote|eedwin|eedwi|ne|ge|ac|ka|jo|is|an|br|so|ed)(?:-?[0-3]{1,4})?\b)/giu,
      '$1 '
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
}
