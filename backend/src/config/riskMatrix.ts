// Diccionario de factores de la matriz LA/FT. Cada factor se puntúa de 0 a 5 con la escala definida aquí.

export const FACTOR_KEYS = ['monto', 'frecuencia', 'producto', 'canal', 'jurisdiccion', 'perfil', 'pep'] as const;
export type FactorKey = (typeof FACTOR_KEYS)[number];
export type Weights = Record<FactorKey, number>;
export type Scores = Record<FactorKey, number | null>;

export interface FactorDef {
  key: FactorKey;
  label: string;
  short: string;
  question: string;
  scale: [string, string, string, string, string, string]; // significado de 0..5
}

export const FACTORS: FactorDef[] = [
  {
    key: 'monto', label: 'Monto', short: 'MONTO',
    question: '¿Qué tan alto es el monto frente al perfil transaccional del cliente?',
    scale: [
      'Habitual para el perfil',
      'Ligeramente superior al habitual',
      'Hasta 1.5 veces el perfil',
      'Entre 1.5 y 2 veces el perfil, o cerca de umbrales de reporte',
      'Entre 2 y 3 veces el perfil, o fraccionado bajo umbrales',
      'Varias veces el perfil',
    ],
  },
  {
    key: 'frecuencia', label: 'Frecuencia', short: 'FREC.',
    question: '¿Con qué frecuencia se repite la operación?',
    scale: [
      'Esporádica',
      'Mensual, acorde al perfil',
      'Quincenal o algo más frecuente que lo habitual',
      'Semanal o en varias sucursales',
      'Varias veces por semana',
      'Repetición diaria o sostenida',
    ],
  },
  {
    key: 'producto', label: 'Producto', short: 'PROD.',
    question: '¿Qué tan riesgoso u opaco es el producto utilizado?',
    scale: [
      'Bajo riesgo, como nómina',
      'Cuenta de ahorro con límites',
      'Remesas o cuenta monetaria estándar',
      'Efectivo, compra de divisas o cuenta monetaria con alto movimiento',
      'Transferencias internacionales o comercio exterior',
      'Opaco o de alto riesgo (activos virtuales, terceros no identificados)',
    ],
  },
  {
    key: 'canal', label: 'Canal', short: 'CANAL',
    question: '¿Por qué canal se realizó y qué tan verificado está?',
    scale: [
      'Presencial y verificado',
      'Presencial con verificación parcial',
      'Banca en línea con autenticación fuerte',
      'Agente bancario o banca en línea estándar',
      'Remoto con verificación débil',
      'Remoto sin verificación',
    ],
  },
  {
    key: 'jurisdiccion', label: 'Jurisdicción', short: 'JURISD.',
    question: '¿Qué países intervienen en la operación?',
    scale: [
      'Nacional',
      'Países de la región con controles equivalentes',
      'Países con controles intermedios',
      'Zonas fronterizas o países con debilidades señaladas',
      'Países en lista gris del GAFI',
      'Jurisdicción de alto riesgo (lista negra del GAFI o paraíso fiscal)',
    ],
  },
  {
    key: 'perfil', label: 'Perfil del cliente', short: 'PERFIL',
    question: '¿Es coherente la operación con la actividad declarada del cliente?',
    scale: [
      'Simple y coherente',
      'Coherente con variaciones menores',
      'Variaciones que requieren explicación',
      'Información desactualizada o parcialmente coherente',
      'Poco coherente con su actividad',
      'Incoherente con su actividad',
    ],
  },
  {
    key: 'pep', label: 'PEP / Sanciones', short: 'PEP/SANC.',
    question: '¿Tiene el cliente o sus relacionados vínculo con PEP o listas de sanciones?',
    scale: [
      'Sin vínculo',
      'Coincidencia de nombre descartada',
      'Asociado lejano de un PEP',
      'Familiar o asociado cercano de un PEP',
      'Es PEP o coincidencia probable en listas',
      'Vínculo confirmado',
    ],
  },
];

export const DEFAULT_WEIGHTS: Weights = {
  monto: 20, frecuencia: 15, producto: 10, canal: 10, jurisdiccion: 20, perfil: 15, pep: 10,
};

// Regla de dato faltante: puntaje conservador y marca visible. El evento nunca se descarta.
export const MISSING_SCORE = 3;

export const LEVELS = [
  { key: 'BAJO', label: 'Bajo', min: 0, max: 24 },
  { key: 'MEDIO', label: 'Medio', min: 25, max: 49 },
  { key: 'ALTO', label: 'Alto', min: 50, max: 74 },
  { key: 'CRITICO', label: 'Crítico', min: 75, max: 100 },
] as const;
export type LevelKey = (typeof LEVELS)[number]['key'];

// Catálogo de controles compensatorios (restan) y agravantes (suman) para el formulario.
export const ADJUSTMENT_CATALOG = {
  CONTROL: [
    { description: 'Doble validación de la operación', points: 2 },
    { description: 'Debida diligencia reforzada (DDR) aplicada', points: 2 },
    { description: 'Expediente KYC actualizado', points: 2 },
    { description: 'Monitoreo transaccional automatizado', points: 3 },
    { description: 'Revisión del oficial de cumplimiento', points: 2 },
    { description: 'Verificación de identidad presencial', points: 2 },
    { description: 'Límite transaccional por producto', points: 2 },
  ],
  AGRAVANTE: [
    { description: 'Cliente se negó a declarar origen de fondos', points: 6 },
    { description: 'Fraccionamiento deliberado de operaciones', points: 5 },
    { description: 'Uso de terceros o intermediarios no identificados', points: 5 },
    { description: 'Alerta previa sobre el mismo cliente', points: 4 },
  ],
} as const;
