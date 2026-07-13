export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  /** 登录后默认跳转路径（按角色决定） */
  defaultRedirect: string;
  user: {
    id: string;
    username: string;
    email: string;
    roles: string[];
    merchantId?: string;
  };
}

/** 按角色返回默认跳转路径 */
export function getDefaultRedirect(roles: string[]): string {
  if (roles.includes('SUPER_ADMIN')) return '/admin/dashboard';
  if (roles.includes('MERCHANT')) return '/merchant/dashboard';
  return '/';
}
