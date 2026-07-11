import { Controller, Get, Param, Query } from '@nestjs/common';
import { ShopService } from './shop.service';
import { ShopProductQueryDto } from './dto/shop-product-query.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get(':code')
  @Public()
  async getShop(@Param('code') code: string) {
    return this.shopService.findShopByCode(code);
  }

  @Get(':code/products')
  @Public()
  async listProducts(@Param('code') code: string, @Query() query: ShopProductQueryDto) {
    const shop = await this.shopService.findShopByCode(code);
    return this.shopService.listProducts(shop.id, {
      categoryId: query.categoryId,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 50,
    });
  }

  @Get('product/:id')
  @Public()
  async getProduct(@Param('id') id: string) {
    return this.shopService.findProductForBuyer(id);
  }
}
