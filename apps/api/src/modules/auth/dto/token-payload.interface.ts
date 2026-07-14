export interface TokenPayload {
  sub: string; // userId
  username: string;
  email: string;
  roles: string[];
  merchantId?: string;
  jti?: string; // JWT ID（用于刷新令牌追踪）
  type?: 'access' | 'refresh';
  epoch?: number; // token 版本号，改密/角色变更时 +1 使旧 token 失效
}
