import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from './api-key.service';

export const API_KEY_REQUIRED = 'apiKeyRequired';
export const API_KEY_SCOPE = 'apiKeyScope';

/** 标记接口需要 API Key 鉴权 */
export const RequireApiKey =
  (scope?: string) => (target: object, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(API_KEY_REQUIRED, true, descriptor?.value ?? target);
    if (scope) {
      Reflect.defineMetadata(API_KEY_SCOPE, scope, descriptor?.value ?? target);
    }
  };

export interface ApiKeyRequest {
  apiKey?: {
    apiKeyId: string;
    merchantId: string;
    scopes: string[];
    name: string;
  };
}

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      {
        headers: { 'x-api-key'?: string; authorization?: string };
      } & ApiKeyRequest
    >();

    // 从 X-API-Key 或 Authorization: Bearer sk_live_xxx 提取
    const rawKey =
      request.headers['x-api-key'] ||
      (request.headers.authorization?.startsWith('Bearer sk_live_')
        ? request.headers.authorization.slice(7)
        : undefined);

    if (!rawKey) {
      throw new UnauthorizedException('缺少 API Key（X-API-Key 或 Bearer sk_live_xxx）');
    }

    const payload = await this.apiKeyService.validate(rawKey);
    request.apiKey = payload;

    // 检查 scope
    const requiredScope = this.reflector.getAllAndOverride<string | undefined>(API_KEY_SCOPE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredScope && !payload.scopes.includes(requiredScope)) {
      throw new ForbiddenException(`API Key 缺少 ${requiredScope} 权限`);
    }

    return true;
  }
}
