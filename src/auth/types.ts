export interface UserPayload {
  sub: number;
  email: string;
}

export interface UserToken {
  access_token: string;
}

import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: UserPayload;
}
