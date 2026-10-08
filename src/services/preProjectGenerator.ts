/**
 * Generador masivo de Preproyectos para ANFETA.
 * Paridad 1:1 con PreProjectGeneratorService.cs de ANFETA Desktop.
 */

export interface PreProjectStep {
  title: string;
  category: string;
  description: string;
  isCompleted?: boolean;
}

export interface GeneratedPreProjectPlan {
  domain: string;
  suffix: string;
  fullName: string;
  steps: PreProjectStep[];
  requiredDropboxFolders: string[];
  initialWhatsAppMessage: string;
}

export class PreProjectGeneratorService {
  public static generatePlan(domain: string, suffix?: string): GeneratedPreProjectPlan {
    let cleanDomain = (domain || "").trim().toLowerCase();
    if (!cleanDomain.includes(".")) {
      cleanDomain = `${cleanDomain}.com`;
    }

    const cleanSuffix = (suffix || "").trim() || "preproyecto";
    const fullName = `${cleanDomain}.${cleanSuffix}`;

    const steps: PreProjectStep[] = [
      {
        title: "1. Crear estructura de carpetas en Dropbox DRX",
        category: "Almacenamiento",
        description: `Crear carpeta DRX/${cleanDomain}.Carpeta y subdirectorios de trabajo (.webs, .ads, .cotizacion, .auditoria, etc.)`,
      },
      {
        title: "2. Creación del grupo de WhatsApp con cliente",
        category: "Comunicación",
        description: `Crear grupo de WhatsApp para ${cleanDomain} e invitar a los integrantes responsables (John, Isaias, Carla, etc.) y al cliente.`,
      },
      {
        title: "3. Página base de Notion para Pre-Proyecto",
        category: "Notion",
        description: `Registrar la página ${cleanDomain}.preproyecto con checklist inicial, responsables asignados y fecha de arranque.`,
      },
      {
        title: "4. Auditoría y Benchmark de Inspiración",
        category: "Inspiración / Auditoría",
        description: `Recopilar referencias de la competencia y capturas de inspiración en ${cleanDomain}.auditoria y referencias en inspiracion.com.webs.`,
      },
      {
        title: "5. Cotización y Alcance formal",
        category: "Finanzas",
        description: `Definir alcance, paquetes y presupuesto en ${cleanDomain}.cotizacion antes de liberar a producción.`,
      },
      {
        title: "6. Onboarding inicial y reunión con el cliente",
        category: "Atención Cliente",
        description: "Enviar mensaje de bienvenida y agendar llamada de kick-off para confirmación de requerimientos clave.",
      },
    ];

    const folders: string[] = [
      `${cleanDomain}.Carpeta`,
      `${cleanDomain}.webs`,
      `${cleanDomain}.ads`,
      `${cleanDomain}.auditoria`,
      `${cleanDomain}.cotizacion`,
    ];

    const whatsAppMsg =
      `¡Hola! Bienvenidos al grupo de trabajo de *${cleanDomain}* 🚀.\n` +
      `Estaremos coordinando aquí todo el desarrollo, avances y entregables de su proyecto web y estrategias digitales con el equipo de Weblab.\n\n` +
      `Cualquier duda o solicitud estamos a sus órdenes.`;

    return {
      domain: cleanDomain,
      suffix: cleanSuffix,
      fullName,
      steps,
      requiredDropboxFolders: folders,
      initialWhatsAppMessage: whatsAppMsg,
    };
  }
}
