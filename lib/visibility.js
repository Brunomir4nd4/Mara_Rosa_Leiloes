// O que cada função pode ver de um lote.
// Curral (e qualquer função fora do escritório) não vê valor, proposta nem o valor pedido pelo dono.
import { OFFICE } from "./roles";

export function lotForRole(lot, role) {
  if (!lot || OFFICE.includes(role) || !lot.pista) return lot;
  const { status, buyer, term } = lot.pista;
  return { ...lot, pista: { status, buyer, term } };
}
