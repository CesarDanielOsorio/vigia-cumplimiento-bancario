export type ListKey = 'debarment' | 'peps' | 'sanctions' | 'crime';

export interface ListConfig {
  key: ListKey;
  name: string;
  description: string;
  icon: 'ban' | 'users' | 'globe' | 'alert';
  color: 'amber' | 'violet' | 'sky' | 'rose';
  datasets: string[];
  sources: { label: string; url: string }[];
}

export const LISTS: ListConfig[] = [
  {
    key: 'debarment',
    name: 'Empresas Sancionadas (Banco Mundial)',
    description:
      'Empresas e individuos sancionados por el Banco Mundial y otros organismos multilaterales por corrupción, fraude o malas prácticas.',
    icon: 'ban',
    color: 'amber',
    datasets: ['debarment'],
    sources: [
      { label: 'World Bank Listed Firms', url: 'https://www.worldbank.org/en/projects-operations/procurement/debarred-firms' },
    ],
  },
  {
    key: 'peps',
    name: 'Personas Políticamente Expuestas (PEPs)',
    description:
      'Funcionarios públicos, políticos, sus familiares y asociados cercanos a nivel mundial. Requieren Debida Diligencia Reforzada (Decreto 15-2026).',
    icon: 'users',
    color: 'violet',
    datasets: ['peps'],
    sources: [],
  },
  {
    key: 'sanctions',
    name: 'Sanciones Internacionales Consolidadas',
    description:
      'Lista consolidada de personas y entidades sancionadas por OFAC (EE.UU.), ONU, Unión Europea, Reino Unido y más de 90 fuentes oficiales.',
    icon: 'globe',
    color: 'sky',
    datasets: ['sanctions'], // colección completa de OpenSanctions (~95 fuentes)
    sources: [
      { label: 'OFAC SDN', url: 'https://sanctionssearch.ofac.treas.gov/' },
      { label: 'OFAC Consolidated', url: 'https://ofac.treasury.gov/consolidated-sanctions-list-non-sdn-lists' },
      { label: 'UE Consolidated', url: 'https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions' },
      { label: 'ONU Consolidated', url: 'https://www.un.org/securitycouncil/content/un-sc-consolidated-list' },
      { label: 'UK Sanctions List (FCDO)', url: 'https://www.gov.uk/government/publications/the-uk-sanctions-list' },
    ],
  },
  {
    key: 'crime',
    name: 'Personas Buscadas / Criminales',
    description: 'Personas buscadas por autoridades policiales internacionales (Interpol, FBI, etc.).',
    icon: 'alert',
    color: 'rose',
    datasets: ['crime'],
    sources: [{ label: 'FBI Most Wanted', url: 'https://www.fbi.gov/wanted' }],
  },
];

export const OS_BASE = 'https://data.opensanctions.org/datasets/latest';
export const STALE_HOURS = 48;

export const isListKey = (k: string): k is ListKey => LISTS.some(l => l.key === k);
