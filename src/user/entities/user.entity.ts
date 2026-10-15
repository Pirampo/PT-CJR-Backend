// representa um usuário dentro da aplicação
// tipo dados esperados pela requisição

export class Usuarios {
  id: Number;
  username: String;
  nome: String;
  email: String;
  senha_hash: String;
  foto_perfil_url: String;
  createdAt: Date | null;
  updatedAt: Date | null;
}
