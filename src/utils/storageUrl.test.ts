import { describe, it, expect } from 'vitest';
import { parseStorageRef } from './storageUrl';

// Buckets privados da foundation: avatars, tenant-logos, ticket-attachments.
// Qualquer outro bucket ou host externo passa direto (retorna null).
describe('parseStorageRef', () => {
    it('retorna null para vazio/nulo/undefined', () => {
        expect(parseStorageRef(null)).toBeNull();
        expect(parseStorageRef(undefined)).toBeNull();
        expect(parseStorageRef('')).toBeNull();
    });

    it('extrai bucket+path de URL pública de bucket privado', () => {
        const url = 'https://proj.supabase.co/storage/v1/object/public/avatars/tenant1/perfis/abc.jpg';
        expect(parseStorageRef(url)).toEqual({
            bucket: 'avatars',
            path: 'tenant1/perfis/abc.jpg',
        });
    });

    it('extrai bucket+path de URL assinada (sign) ignorando a querystring', () => {
        const url = 'https://proj.supabase.co/storage/v1/object/sign/ticket-attachments/t1/anexo.png?token=xyz';
        expect(parseStorageRef(url)).toEqual({
            bucket: 'ticket-attachments',
            path: 't1/anexo.png',
        });
    });

    it('decodifica caracteres do path', () => {
        const url = 'https://proj.supabase.co/storage/v1/object/public/avatars/t1/a%20b.jpg';
        expect(parseStorageRef(url)?.path).toBe('t1/a b.jpg');
    });

    it('retorna null (passthrough) para bucket fora da lista de privados', () => {
        const url = 'https://proj.supabase.co/storage/v1/object/public/public-assets/u1/logo.png';
        expect(parseStorageRef(url)).toBeNull();
    });

    it('retorna null (passthrough) para URL externa', () => {
        expect(parseStorageRef('https://cdn.exemplo.com/files/abc.png')).toBeNull();
    });

    it('interpreta referência "bucket/caminho" de bucket privado', () => {
        expect(parseStorageRef('avatars/t1/u1/uuid.jpg')).toEqual({
            bucket: 'avatars',
            path: 't1/u1/uuid.jpg',
        });
        expect(parseStorageRef('tenant-logos/t1/logo.png')).toEqual({
            bucket: 'tenant-logos',
            path: 't1/logo.png',
        });
    });

    it('retorna null para referência de bucket fora da lista', () => {
        expect(parseStorageRef('public-assets/u1/a.png')).toBeNull();
        expect(parseStorageRef('lgpd-exports/x/y.json')).toBeNull();
    });
});
