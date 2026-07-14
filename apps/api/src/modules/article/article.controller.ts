import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ArticleService } from './article.service';
import { ArticleType, ArticleStatus } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

class ArticleQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number = 20;
  @IsOptional() @IsEnum(ArticleType) type?: ArticleType;
  @IsOptional() @IsEnum(ArticleStatus) status?: ArticleStatus;
}

class CreateArticleDto {
  @IsEnum(ArticleType) type!: ArticleType;
  @IsString() @MaxLength(255) title!: string;
  @IsString() content!: string;
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9-]*$/i, { message: 'slug 只能含字母、数字、短横线' })
  slug?: string;
  @IsOptional() @IsString() @MaxLength(500) summary?: string;
  @IsOptional() @IsEnum(ArticleStatus) status?: ArticleStatus;
  @IsOptional() @Type(() => Number) @IsInt() sort?: number;
}

class UpdateArticleDto {
  @IsOptional() @IsEnum(ArticleType) type?: ArticleType;
  @IsOptional() @IsString() @MaxLength(255) title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9-]*$/i, { message: 'slug 只能含字母、数字、短横线' })
  slug?: string;
  @IsOptional() @IsString() @MaxLength(500) summary?: string;
  @IsOptional() @IsEnum(ArticleStatus) status?: ArticleStatus;
  @IsOptional() @Type(() => Number) @IsInt() sort?: number;
}

@ApiTags('article')
@Controller()
export class ArticleController {
  constructor(private readonly service: ArticleService) {}

  // ============== 公开接口 ==============

  /** 已发布公告列表（按 type 过滤） */
  @Get('articles')
  @Public()
  async list(@Query('type') type?: ArticleType) {
    return this.service.listPublished(type);
  }

  /** 单篇公告（按 slug） */
  @Get('articles/:slug')
  @Public()
  async getBySlug(@Param('slug') slug: string) {
    return this.service.getPublishedBySlug(slug);
  }

  /** 店铺页底部公告摘要（免责声明/用户协议/可销售商品） */
  @Get('articles/notices/shop-footer')
  @Public()
  async getShopFooterNotices() {
    return this.service.getShopFooterNotices();
  }

  // ============== 后台管理 ==============

  @Get('admin/articles')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async listForAdmin(@Query() query: ArticleQueryDto) {
    return this.service.listForAdmin({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      type: query.type,
      status: query.status,
    });
  }

  @Get('admin/articles/:id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async findOneForAdmin(@Param('id') id: string) {
    return this.service.findOneForAdmin(id);
  }

  @Post('admin/articles')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateArticleDto, @Req() req: Request) {
    return this.service.create(dto, {
      actorId: user.userId,
      actorName: user.username,
      ip: req.ip,
      ua: req.get('user-agent'),
    });
  }

  @Put('admin/articles/:id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, {
      actorId: user.userId,
      actorName: user.username,
      ip: req.ip,
      ua: req.get('user-agent'),
    });
  }

  @Delete('admin/articles/:id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async delete(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Req() req: Request) {
    return this.service.delete(id, {
      actorId: user.userId,
      actorName: user.username,
      ip: req.ip,
      ua: req.get('user-agent'),
    });
  }
}
