import { useAuth } from '../contexts/AuthContext';

export interface Terminology {
    client: string;
    clients: string;
    clientLower: string;
    clientsLower: string;
    newClient: string;
    addClient: string;
    clientProfile: string;
    clientData: string;
    manageClients: string;
    noClients: string;
    searchClient: string;
    deleteClient: string;
}

/**
 * Monta o vocabulario a partir do nome que o segmento do tenant da ao seu
 * cliente final. Cada assinante fala "cliente", "aluno", "paciente" ou
 * "associado", e a interface acompanha sem duplicar tela.
 *
 * Para adicionar um segmento, basta uma entrada em SEGMENT_NOUNS: o resto das
 * frases e derivado. O valor lido e tenants.segmento.
 */
const SEGMENT_NOUNS: Record<string, { singular: string; plural: string; feminino?: boolean }> = {
    geral:       { singular: 'Cliente',   plural: 'Clientes' },
    educacao:    { singular: 'Aluno',     plural: 'Alunos' },
    saude:       { singular: 'Paciente',  plural: 'Pacientes' },
    associacao:  { singular: 'Associado', plural: 'Associados' },
    juridico:    { singular: 'Cliente',   plural: 'Clientes' },
    imobiliario: { singular: 'Cliente',   plural: 'Clientes' },
};

const DEFAULT_SEGMENT = 'geral';

function build(singular: string, plural: string, feminino = false): Terminology {
    const artigo = feminino ? 'a' : 'o';
    const novo = feminino ? 'Nova' : 'Novo';
    const lower = singular.toLowerCase();
    const lowerPlural = plural.toLowerCase();

    return {
        client: singular,
        clients: plural,
        clientLower: lower,
        clientsLower: lowerPlural,
        newClient: `${novo} ${singular}`,
        addClient: `Adicionar ${singular}`,
        clientProfile: `Perfil d${artigo} ${singular}`,
        clientData: `Dados d${artigo} ${singular}`,
        manageClients: `Gerenciamento de ${plural}`,
        noClients: `Nenhum ${lower} ainda`,
        searchClient: `Buscar por ${lower}...`,
        deleteClient: `Excluir ${singular}?`,
    };
}

export const useTerminology = (): Terminology => {
    const { tenant } = useAuth();
    const segmento = (tenant as any)?.segmento?.toLowerCase() || DEFAULT_SEGMENT;
    const noun = SEGMENT_NOUNS[segmento] ?? SEGMENT_NOUNS[DEFAULT_SEGMENT];

    return build(noun.singular, noun.plural, noun.feminino);
};
