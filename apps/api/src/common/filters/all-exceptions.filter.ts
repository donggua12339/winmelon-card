import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    const code =
      typeof errorResponse === 'object' && errorResponse !== null
        ? ((errorResponse as Record<string, unknown>).code as string | undefined) ??
          ((errorResponse as Record<string, unknown>).error as string | undefined) ??
          this.statusToCode(status)
        : this.statusToCode(status);

    const message =
      typeof errorResponse === 'string'
        ? errorResponse
        : typeof errorResponse === 'object' && errorResponse !== null
          ? ((errorResponse as Record<string, unknown>).message as string | string[] | undefined)
          : this.statusToMessage(status);

    const finalMessage = Array.isArray(message) ? message.join('; ') : (message ?? 'Unknown error');

    if (status >= 500) {
      this.logger.error(
        `[${request.id ?? '-'}] ${request.method} ${request.url} ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`[${request.id ?? '-'}] ${request.method} ${request.url} ${status} ${finalMessage}`);
    }

    response.status(status).json({
      code,
      message: finalMessage,
      requestId: request.id,
    });
  }

  private statusToCode(status: number): string {
    return `HTTP_${status}`;
  }

  private statusToMessage(status: number): string {
    switch (status) {
      case 400:
        return '请求参数错误';
      case 401:
        return '未授权';
      case 403:
        return '禁止访问';
      case 404:
        return '资源不存在';
      case 429:
        return '请求过于频繁';
      case 500:
        return '服务器内部错误';
      default:
        return '未知错误';
    }
  }
}
