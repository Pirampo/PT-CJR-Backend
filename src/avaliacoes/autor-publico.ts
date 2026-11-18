export type AutorAvaliacao = {
  id: number;
  nome: string;
  username: string;
  foto_perfil_url: string | null;
};

// Mantém a mesma proteção dos perfis públicos para usernames legados privados.
export function autorPublico(autor: AutorAvaliacao) {
  return {
    id: autor.id,
    nome: autor.nome,
    username: /^[A-Za-z0-9_.-]+$/.test(autor.username) ? autor.username : null,
    foto_perfil_url: autor.foto_perfil_url,
  };
}
