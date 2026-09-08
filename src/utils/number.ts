/**
 * Converte um número no formato pt-BR (vírgula decimal) para número JS.
 *
 * Aceita vírgula OU ponto e ignora espaços nas bordas. Retorna `null` quando o valor
 * é vazio ou não é um número válido.
 *
 * IMPORTANTE: normaliza a vírgula para ponto ANTES do parse — nunca faz `parseFloat('1,70')`
 * direto (que trunca na vírgula e devolve 1). É a proteção central contra o bug de
 * arredondamento silencioso em valores decimais informados pelo usuário.
 */
export function parseDecimalBR(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim().replace(',', '.');
    if (normalized === '') return null;
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : null;
}
