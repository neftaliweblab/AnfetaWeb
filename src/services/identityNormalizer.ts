export const PERSON_ALIASES: Record<string, string[]> = {
  Neftali: ["nneft", "nnetf", "neft", "netf", "neftali"],
  Karla: ["kkarl", "karl", "karla"],
  Isaias: ["iisai", "iisaia", "isai", "isaias"],
  Andrade: ["aandr", "andr", "andrade"],
  Brian: ["bbria", "bria", "brian"],
  Genaro: ["ggena", "gena", "genaro"],
  John: ["jjohn", "john"],
  Sotelo: ["ssote", "sote", "eedua", "edua", "sotelo"],
  Acalli: ["aacal", "acal", "acalli"],
  Emmanuel: ["eemma", "emma", "emmanuel"],
};

export const PERSON_METADATA: Record<
  string,
  { color: string; avatar: string; role?: string; notionUrl?: string }
> = {
  John: { color: "#38BDF8", avatar: "JO", role: "Supervisor / Dirección", notionUrl: "https://app.notion.com/p/36eabd7d91b780f2841bcd50f8a2b4ac?source=copy_link" },
  Karla: { color: "#F472B6", avatar: "KA", role: "Diseño & Web", notionUrl: "https://app.notion.com/p/36eabd7d91b7800facbcd6cf9514277c?source=copy_link" },
  Isaias: { color: "#4ADE80", avatar: "IS", role: "SEO & Contenido", notionUrl: "https://app.notion.com/p/384abd7d91b7801499bdff6ed5a4a2fc?source=copy_link" },
  Sotelo: { color: "#FB923C", avatar: "SO", role: "Cobranza & Operaciones" },
  Acalli: { color: "#A78BFA", avatar: "AC", role: "Diseño & Multimedia" },
  Andrade: { color: "#FBBF24", avatar: "AN", role: "ADS & Campañas", notionUrl: "https://app.notion.com/p/380abd7d91b7803292cdd39271df4865?source=copy_link" },
  Brian: { color: "#2DD4BF", avatar: "BR", role: "Desarrollo Web", notionUrl: "https://app.notion.com/p/36eabd7d91b780988946c81705570b78?source=copy_link" },
  Genaro: { color: "#E879F9", avatar: "GE", role: "Desarrollo & Sistemas", notionUrl: "https://app.notion.com/p/36eabd7d91b780bea0a4dc662d32b03a?source=copy_link" },
  Neftali: { color: "#60A5FA", avatar: "NE", role: "Desarrollo & Automatización", notionUrl: "https://app.notion.com/p/36eabd7d91b7809a982af00b04e17a93?source=copy_link" },
  Emmanuel: { color: "#F87171", avatar: "EM", role: "Soporte & Web" },
  "Sin asignar": { color: "#94A3B8", avatar: "—", role: "Sin asignar" },
};

export function normalizePerson(input: string | null | undefined): string {
  if (!input) return "Sin asignar";
  let clean = input.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (clean === "—" || clean === "-" || clean === "sin asignar" || clean === "") {
    return "Sin asignar";
  }

  // Si viene como correo ej: nnetf@practicante.com o nneft@anfeta.com
  if (clean.includes("@")) {
    clean = clean.split("@")[0].trim();
  }

  for (const [canonical, aliases] of Object.entries(PERSON_ALIASES)) {
    if (canonical.toLowerCase() === clean) return canonical;
    if (aliases.some((alias) => clean === alias || new RegExp('^' + alias + '(?:0{2,4}|00[1-3])$').test(clean))) {
      return canonical;
    }
  }

  return input.trim();
}

export function getPersonInitials(name: string): string {
  const norm = normalizePerson(name);
  if (PERSON_METADATA[norm]) return PERSON_METADATA[norm].avatar;
  return name.slice(0, 2).toUpperCase();
}

export function getPersonColor(name: string): string {
  const norm = normalizePerson(name);
  return PERSON_METADATA[norm]?.color || "#94A3B8";
}

// Acceso a la misma página secundaria usada por el calendario de escritorio.
export const JOHN_SECONDARY_ACTIVITIES_URL = "https://app.notion.com/p/36eabd7d91b780468151f8625cd04aa7?v=380abd7d91b780ddbf2d000c367145a2&source=copy_link";
