import type { DelegadoConvocavel } from '../types/escala';

/**
 * Deterministic initial list of Delegates for local preview before connecting
 * the external Google Spreadsheet of Delegados.
 */
export const SEED_DELEGADOS: DelegadoConvocavel[] = [
  { id: 'del-01', rowIndex: 2, nome: 'Paulo S.', delegacia: '1ª DPCo' },
  { id: 'del-02', rowIndex: 3, nome: 'Caroline', delegacia: 'DEAM - Joinville' },
  { id: 'del-03', rowIndex: 4, nome: 'Filipe B.', delegacia: 'DIC - DH' },
  { id: 'del-04', rowIndex: 5, nome: 'Gabriel', delegacia: '3ª DPCo' },
  { id: 'del-05', rowIndex: 6, nome: 'Eli', delegacia: 'Araquari - DPCO' },
  { id: 'del-06', rowIndex: 7, nome: 'Rafael P.', delegacia: '5ª DPCo' },
];
