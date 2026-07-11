export interface TokenPayload {
  sub: string; // userId
  username: string;
  email: string;
  roles: string[];
  merchantId?: string;
  jti?: string; // JWT ID（用于刷新令牌追踪）
  type?: 'access' | 'refresh';
}
