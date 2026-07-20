import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = exception instanceof HttpException ? exception.getResponse() : undefined;

    const code =
      typeof errorResponse === 'object' && errorResponse !== null
        ? (((errorResponse as Record<string, unknown>).code as string | undefined) ??
          ((errorResponse as Record<string, unknown>).error as string | undefined) ??
          this.statusToCode(status))
        : this.statusToCode(status);

    // class-validator BadRequest 会把每个 constraint detail 透传给用户
    // 这里是信息泄露：暴露 "orderNo must be shorter than 32 characters" 等
    // 解决：对 4xx BadRequest 统一用"请求参数无效" + 详细记日志
    const originalMessage = this.extractMessage(errorResponse);
    const finalMessage = this.sanitizeMessage(exception, status, originalMessage);

    if (status >= 500) {
      this.logger.error(
        `[${request.id ?? '-'}] ${request.method} ${request.url} ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `[${request.id ?? '-'}] ${request.method} ${request.url} ${status} ${originalMessage ?? ''}`.trim(),
      );
    }

    response.status(status).json({
      code,
      message: finalMessage,
      requestId: request.id,
    });
  }

  /**
   * 提取原始消息（用于日志）
   */
  private extractMessage(errorResponse: unknown): string | undefined {
    if (typeof errorResponse === 'string') return errorResponse;
    if (typeof errorResponse === 'object' && errorResponse !== null) {
      const msg = (errorResponse as Record<string, unknown>).message;
      if (Array.isArray(msg)) return msg.join('; ');
      if (typeof msg === 'string') return msg;
    }
    return undefined;
  }

  /**
   * 清洗响应消息，避免泄露：
   * - 密码复杂度规则（"新密码至少 8 位"）
   * - 字段长度限制（"orderNo must be shorter than 32 characters"）
   * - 业务校验规则（regex 不匹配原因等）
   * 仅 4xx 客户端错误做清洗；5xx 透传 "Internal server error"
   */
  private sanitizeMessage(_exception: unknown, status: number, original: string | undefined): string {
    if (status >= 500) {
      return 'Internal server error';
    }
    if (status === 401) {
      return '未登录或登录已过期';
    }
    if (status === 403) {
      return '无权访问';
    }
    if (status === 404) {
      return '资源不存在';
    }
    if (status === 429) {
      return '请求过于频繁，请稍后再试';
    }
    if (status === 400 || status === 422) {
      return '请求参数无效';
    }
    return original ?? this.statusToCode(status);
  }

  private statusToCode(status: number): string {
    return `HTTP_${status}`;
  }

  private statusToMessage(status: number): string {
    const m: Record<number, string> = {
      400: '请求参数无效',
      401: '未登录或登录已过期',
      403: '无权访问',
      404: '资源不存在',
      409: '资源冲突',
      422: '请求参数无效',
      429: '请求过于频繁，请稍后再试',
      500: 'Internal server error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };
    return m[status] ?? 'Unknown error';
  }
}
