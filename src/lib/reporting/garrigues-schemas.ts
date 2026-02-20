/**
 * Garrigues Model Output Schemas
 *
 * Defines TypeScript interfaces and JSON Schema constants for the three
 * Garrigues-format due diligence models used in FMC Due Diligence:
 *
 *   1. Ficha Societaria   — "1.MERC-Ficha societaria" (17 campos)
 *   2. Cuadro de Socios   — "2.MERC-Cuadro de socios-accionistas" (6 campos)
 *   3. Ficha Contingencia  — Red Flag model (10 campos)
 *
 * These schemas serve as the structured output contract between the AI
 * extraction layer and the report-engine / evidence-pack pipeline.
 */

// ============================================================
// TypeScript Interfaces
// ============================================================

/**
 * Ficha Societaria Garrigues — 17 campos
 *
 * Mirrors the "1.MERC-Ficha societaria" sheet from the FMC Due Diligence
 * Excel workbook. Each field follows Garrigues narrative conventions
 * (e.g. full notarial prose for constitution data).
 */
export interface FichaSocietaria {
    /** Denominacion social completa, e.g. "[*], S.L." or "[*], S.A." */
    denominacion: string;

    /**
     * Datos de constitucion.
     * Formato: "Escritura otorgada el [] ante el notario de [], D./Dna. [],
     * con el numero [] de orden de su protocolo."
     */
    datos_constitucion: string;

    /**
     * Informacion registral.
     * Formato: "Inscrita en el Registro Mercantil de [] al tomo [], hoja []-[]."
     */
    informacion_registral: string;

    /** CIF de la sociedad. Formato: "A/B-[*]." */
    cif: string;

    /** Domicilio social. Formato: "[*]." */
    domicilio: string;

    /** Capital social. Formato: "[*] EUR." */
    capital_social: string;

    /**
     * Composicion del capital social — detalle por socio.
     * Formato: "[] es titular de [] acciones/participaciones, numeradas
     * del [] al [], representativas del []% del capital social."
     */
    composicion_capital: string;

    /**
     * Cargas y gravamenes sobre acciones/participaciones.
     * Formato: "Las [] [acciones/participaciones] se encuentran gravadas con [].
     * Si no hay: Sin cargas ni gravamenes."
     */
    cargas_gravamenes: string;

    /**
     * Regimen de transmision de acciones/participaciones.
     * Incluir cualquier restriccion aplicable.
     * Si sociedad unipersonal: "No aplicable."
     */
    regimen_transmision: string;

    /**
     * Organo de administracion.
     * Formato: "[]: D./Dna. [], nombrado con fecha [] por un plazo de [] anos."
     */
    organo_administracion: string;

    /**
     * Retribucion de administradores.
     * Formato: "Segun articulo [] de los estatutos, el cargo [no esta remunerado /
     * esta remunerado como sigue: []]."
     */
    retribucion_administradores: string;

    /**
     * Apoderados.
     * Formato: "Figuran como representantes autorizados: En virtud de
     * escritura otorgada..."
     */
    apoderados: string;

    /**
     * Deposito de cuentas anuales.
     * Formato: "La Sociedad [ha / no ha] depositado sus cuentas anuales
     * del ejercicio [ano]."
     */
    deposito_cuentas: string;

    /**
     * Reserva legal.
     * Formato: "A 31 de diciembre de [ano], la reserva legal asciende
     * a [X] EUR ([X]% del CS)."
     */
    reserva_legal: string;

    /**
     * Desequilibrio patrimonial.
     * Formato: "A 31 de diciembre de [ano], la Sociedad [no se encuentra /
     * se encuentra] en situacion de desequilibrio patrimonial."
     */
    desequilibrio_patrimonial: string;

    /**
     * Auditores.
     * Formato: "[] ha sido designado auditor para los ejercicios [], [] y []."
     */
    auditores: string;

    /**
     * Libros societarios.
     * Formato: "La Sociedad tiene debidamente legalizados los libros
     * societarios obligatorios."
     */
    libros_societarios: string;
}

/**
 * Cuadro de Socios Garrigues — 6 campos
 *
 * Mirrors the "2.MERC-Cuadro de socios-accionistas" sheet. One entry
 * per shareholder/partner row.
 */
export interface CuadroSocios {
    /** Nombre completo del socio o accionista. */
    nombre_socio: string;

    /** Porcentaje de participacion en el capital social. Formato: "[X]%". */
    porcentaje_capital: string;

    /** Numero total de participaciones o acciones. */
    numero_participaciones: number;

    /** Numeracion de las participaciones. Formato: "del [] al [], ambas inclusive". */
    numeracion: string;

    /**
     * Titulo de propiedad.
     * Formato: "Escritura otorgada el [] ante el notario de []..."
     */
    titulo_propiedad: string;

    /**
     * Cargas sobre las participaciones.
     * Formato: "Gravadas con [] / Sin cargas ni gravamenes."
     */
    cargas: string;
}

/**
 * Ficha de Contingencia Garrigues — Red Flag model, 10 campos
 *
 * Used across all DD areas (MERC, CONT, LAB, FISCAL, etc.) to record
 * individual findings, risk qualifications and buyer recommendations.
 */
export interface FichaContingencia {
    /** Numero de referencia unico del hallazgo. */
    numero_referencia: string;

    /** Area de revision: MERC, CONT, LAB, FISCAL, IP, INMOB, etc. */
    area_revision: string;

    /** Descripcion detallada del hallazgo. */
    descripcion_hallazgo: string;

    /** Documentos de soporte consultados. */
    documentos_soporte: string;

    /**
     * Calificacion del riesgo.
     * Valores esperados: "alto" | "medio" | "bajo" o "red flag" | "yellow flag".
     */
    calificacion_riesgo: string;

    /** Cuantificacion estimada del riesgo en EUR. */
    cuantificacion_estimada: string;

    /**
     * Probabilidad de materializacion.
     * Valores esperados: "probable" | "posible" | "remoto".
     */
    probabilidad_materializacion: string;

    /** Descripcion del impacto sobre la operacion. */
    impacto_operacion: string;

    /**
     * Recomendacion para el comprador.
     * Ejemplos: "incluir en R&W", "ajuste precio", "preclosing",
     * "postclosing", etc.
     */
    recomendacion_comprador: string;

    /** Referencias de evidencia. Array de IDs tipo SRC-001. */
    evidencias: string[];
}

// ============================================================
// JSON Schema Constants
// ============================================================

/**
 * JSON Schema for FichaSocietaria.
 * Can be used as the `response_format` / structured output schema
 * when calling the LLM extraction layer.
 */
export const FICHA_SOCIETARIA_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'FichaSocietariaGarrigues',
    description:
        'Ficha Societaria — 17 campos siguiendo formato Garrigues. ' +
        'Fuente: hoja "1.MERC-Ficha societaria" del Excel FMC Due Diligence.',
    type: 'object' as const,
    properties: {
        denominacion: {
            type: 'string' as const,
            description: 'Denominacion social completa, e.g. "[*], S.L." o "[*], S.A."',
        },
        datos_constitucion: {
            type: 'string' as const,
            description:
                'Datos de constitucion. Formato: "Escritura otorgada el [] ante el notario de [], ' +
                'D./Dna. [], con el numero [] de orden de su protocolo."',
        },
        informacion_registral: {
            type: 'string' as const,
            description:
                'Informacion registral. Formato: "Inscrita en el Registro Mercantil de [] ' +
                'al tomo [], hoja []-[]."',
        },
        cif: {
            type: 'string' as const,
            description: 'CIF de la sociedad. Formato: "A/B-[*]."',
        },
        domicilio: {
            type: 'string' as const,
            description: 'Domicilio social.',
        },
        capital_social: {
            type: 'string' as const,
            description: 'Capital social. Formato: "[*] EUR."',
        },
        composicion_capital: {
            type: 'string' as const,
            description:
                'Composicion del capital social. Formato: "[] es titular de [] acciones/participaciones, ' +
                'numeradas del [] al [], representativas del []% del capital social."',
        },
        cargas_gravamenes: {
            type: 'string' as const,
            description:
                'Cargas y gravamenes. Formato: "Las [] [acciones/participaciones] se encuentran ' +
                'gravadas con []. Si no hay: Sin cargas ni gravamenes."',
        },
        regimen_transmision: {
            type: 'string' as const,
            description:
                'Regimen de transmision. Incluir restricciones aplicables. ' +
                'Si unipersonal: "No aplicable."',
        },
        organo_administracion: {
            type: 'string' as const,
            description:
                'Organo de administracion. Formato: "[]: D./Dna. [], nombrado con fecha [] ' +
                'por un plazo de [] anos."',
        },
        retribucion_administradores: {
            type: 'string' as const,
            description:
                'Retribucion de administradores. Formato: "Segun articulo [] de los estatutos, ' +
                'el cargo [no esta remunerado / esta remunerado como sigue: []]."',
        },
        apoderados: {
            type: 'string' as const,
            description:
                'Apoderados. Formato: "Figuran como representantes autorizados: ' +
                'En virtud de escritura otorgada..."',
        },
        deposito_cuentas: {
            type: 'string' as const,
            description:
                'Deposito de cuentas anuales. Formato: "La Sociedad [ha / no ha] ' +
                'depositado sus cuentas anuales del ejercicio [ano]."',
        },
        reserva_legal: {
            type: 'string' as const,
            description:
                'Reserva legal. Formato: "A 31 de diciembre de [ano], la reserva legal ' +
                'asciende a [X] EUR ([X]% del CS)."',
        },
        desequilibrio_patrimonial: {
            type: 'string' as const,
            description:
                'Desequilibrio patrimonial. Formato: "A 31 de diciembre de [ano], la Sociedad ' +
                '[no se encuentra / se encuentra] en situacion de desequilibrio patrimonial."',
        },
        auditores: {
            type: 'string' as const,
            description:
                'Auditores. Formato: "[] ha sido designado auditor para los ejercicios [], [] y []."',
        },
        libros_societarios: {
            type: 'string' as const,
            description:
                'Libros societarios. Formato: "La Sociedad tiene debidamente legalizados ' +
                'los libros societarios obligatorios."',
        },
    },
    required: [
        'denominacion',
        'datos_constitucion',
        'informacion_registral',
        'cif',
        'domicilio',
        'capital_social',
        'composicion_capital',
        'cargas_gravamenes',
        'regimen_transmision',
        'organo_administracion',
        'retribucion_administradores',
        'apoderados',
        'deposito_cuentas',
        'reserva_legal',
        'desequilibrio_patrimonial',
        'auditores',
        'libros_societarios',
    ],
    additionalProperties: false,
} as const;

/**
 * JSON Schema for CuadroSocios.
 * Represents one row in the shareholder/partner table.
 */
export const CUADRO_SOCIOS_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'CuadroSociosGarrigues',
    description:
        'Cuadro de Socios — 6 campos siguiendo formato Garrigues. ' +
        'Fuente: hoja "2.MERC-Cuadro de socios-accionistas" del Excel FMC Due Diligence.',
    type: 'object' as const,
    properties: {
        nombre_socio: {
            type: 'string' as const,
            description: 'Nombre completo del socio o accionista.',
        },
        porcentaje_capital: {
            type: 'string' as const,
            description: 'Porcentaje de participacion en el capital social. Formato: "[X]%".',
        },
        numero_participaciones: {
            type: 'number' as const,
            description: 'Numero total de participaciones o acciones.',
        },
        numeracion: {
            type: 'string' as const,
            description: 'Numeracion de participaciones. Formato: "del [] al [], ambas inclusive".',
        },
        titulo_propiedad: {
            type: 'string' as const,
            description:
                'Titulo de propiedad. Formato: "Escritura otorgada el [] ante el notario de []..."',
        },
        cargas: {
            type: 'string' as const,
            description: 'Cargas sobre las participaciones. Formato: "Gravadas con [] / Sin cargas ni gravamenes."',
        },
    },
    required: [
        'nombre_socio',
        'porcentaje_capital',
        'numero_participaciones',
        'numeracion',
        'titulo_propiedad',
        'cargas',
    ],
    additionalProperties: false,
} as const;

/**
 * JSON Schema for FichaContingencia (Red Flag model).
 * Used across all DD areas for structured finding reports.
 */
export const FICHA_CONTINGENCIA_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'FichaContingenciaGarrigues',
    description:
        'Ficha de Contingencia — Red Flag model, 10 campos. ' +
        'Utilizada en todas las areas de revision (MERC, CONT, LAB, FISCAL, etc.).',
    type: 'object' as const,
    properties: {
        numero_referencia: {
            type: 'string' as const,
            description: 'Numero de referencia unico del hallazgo.',
        },
        area_revision: {
            type: 'string' as const,
            description: 'Area de revision: MERC, CONT, LAB, FISCAL, IP, INMOB, etc.',
            enum: ['MERC', 'CONT', 'LAB', 'FISCAL', 'IP', 'INMOB', 'REGULATORIO', 'MEDIOAMBIENTAL', 'DATOS', 'ANTITRUST', 'OTRO'],
        },
        descripcion_hallazgo: {
            type: 'string' as const,
            description: 'Descripcion detallada del hallazgo.',
        },
        documentos_soporte: {
            type: 'string' as const,
            description: 'Documentos de soporte consultados.',
        },
        calificacion_riesgo: {
            type: 'string' as const,
            description: 'Calificacion del riesgo: "alto", "medio", "bajo", "red flag" o "yellow flag".',
            enum: ['alto', 'medio', 'bajo', 'red flag', 'yellow flag'],
        },
        cuantificacion_estimada: {
            type: 'string' as const,
            description: 'Cuantificacion estimada del riesgo en EUR.',
        },
        probabilidad_materializacion: {
            type: 'string' as const,
            description: 'Probabilidad de materializacion: "probable", "posible" o "remoto".',
            enum: ['probable', 'posible', 'remoto'],
        },
        impacto_operacion: {
            type: 'string' as const,
            description: 'Descripcion del impacto sobre la operacion.',
        },
        recomendacion_comprador: {
            type: 'string' as const,
            description:
                'Recomendacion para el comprador: "incluir en R&W", "ajuste precio", ' +
                '"preclosing", "postclosing", etc.',
        },
        evidencias: {
            type: 'array' as const,
            description: 'Referencias de evidencia. Array de IDs tipo SRC-001.',
            items: {
                type: 'string' as const,
            },
        },
    },
    required: [
        'numero_referencia',
        'area_revision',
        'descripcion_hallazgo',
        'documentos_soporte',
        'calificacion_riesgo',
        'cuantificacion_estimada',
        'probabilidad_materializacion',
        'impacto_operacion',
        'recomendacion_comprador',
        'evidencias',
    ],
    additionalProperties: false,
} as const;

// ============================================================
// Model Registry
// ============================================================

/** Supported Garrigues model names. */
export type GarriguesModelName =
    | 'ficha_societaria'
    | 'cuadro_socios'
    | 'ficha_contingencia';

/** Metadata entry for a Garrigues model. */
export interface GarriguesModelEntry {
    /** Human-readable label for the model. */
    label: string;
    /** Short description of the model's purpose. */
    description: string;
    /** JSON Schema constant for structured output validation. */
    schema: Record<string, unknown>;
    /** Number of fields in the model. */
    field_count: number;
    /** Source sheet or section in the FMC Due Diligence Excel. */
    source_sheet: string;
}

/**
 * Registry mapping Garrigues model names to their schemas and metadata.
 *
 * Usage:
 * ```ts
 * const entry = GARRIGUES_MODELS['ficha_societaria'];
 * console.log(entry.schema);   // JSON Schema object
 * console.log(entry.label);    // "Ficha Societaria"
 * ```
 */
export const GARRIGUES_MODELS: Record<GarriguesModelName, GarriguesModelEntry> = {
    ficha_societaria: {
        label: 'Ficha Societaria',
        description:
            'Ficha societaria completa con 17 campos siguiendo el formato narrativo ' +
            'de Garrigues para informes mercantiles de due diligence.',
        schema: FICHA_SOCIETARIA_SCHEMA,
        field_count: 17,
        source_sheet: '1.MERC-Ficha societaria',
    },
    cuadro_socios: {
        label: 'Cuadro de Socios',
        description:
            'Cuadro de socios/accionistas con 6 campos por socio, incluyendo ' +
            'participaciones, numeracion y cargas.',
        schema: CUADRO_SOCIOS_SCHEMA,
        field_count: 6,
        source_sheet: '2.MERC-Cuadro de socios-accionistas',
    },
    ficha_contingencia: {
        label: 'Ficha de Contingencia',
        description:
            'Modelo Red Flag con 10 campos para registrar hallazgos, calificacion ' +
            'de riesgo y recomendaciones al comprador.',
        schema: FICHA_CONTINGENCIA_SCHEMA,
        field_count: 10,
        source_sheet: 'Contingencias (transversal)',
    },
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * Retrieves the JSON Schema for a given Garrigues model name.
 *
 * @param modelName - One of the supported Garrigues model names.
 * @returns The JSON Schema object, or `undefined` if the model name is not recognized.
 *
 * @example
 * ```ts
 * const schema = getGarriguesSchema('ficha_societaria');
 * // => FICHA_SOCIETARIA_SCHEMA
 * ```
 */
export function getGarriguesSchema(
    modelName: string,
): Record<string, unknown> | undefined {
    const entry = GARRIGUES_MODELS[modelName as GarriguesModelName];
    return entry?.schema;
}

/**
 * Returns all supported Garrigues model names.
 *
 * @returns Array of model name strings.
 *
 * @example
 * ```ts
 * const names = getGarriguesModelNames();
 * // => ['ficha_societaria', 'cuadro_socios', 'ficha_contingencia']
 * ```
 */
export function getGarriguesModelNames(): GarriguesModelName[] {
    return Object.keys(GARRIGUES_MODELS) as GarriguesModelName[];
}
