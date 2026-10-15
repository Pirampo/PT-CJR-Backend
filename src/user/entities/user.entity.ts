// representa um usuário dentro da aplicação
// tipo dados esperados pela requisição

export class Usuarios {
  id: number;
  username: string;
  nome: string;
  email: string;
  senha_hash: string;
  foto_perfil_url: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}
