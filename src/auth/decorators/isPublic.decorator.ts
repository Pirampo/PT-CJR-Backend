// permite que qualquer usuario acesse a rota que esteja com esse decorator, permitindo o acesso sem token
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
