import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class ProductType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  price!: number;

  @Field(() => Float, { nullable: true })
  originalPrice?: number;

  @Field()
  status!: string;

  @Field({ nullable: true })
  categoryId?: string;

  @Field(() => Int, { nullable: true })
  purchaseLimit?: number;

  @Field()
  isAutoDelivery!: boolean;

  @Field(() => Int, { nullable: true })
  sort?: number;

  @Field()
  createdAt!: Date;

  @Field()
  shopId!: string;
}

@ObjectType()
export class ShopType {
  @Field(() => ID)
  id!: string;

  @Field()
  code!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  announcement?: string;

  @Field({ nullable: true })
  customDomain?: string;

  @Field()
  isOnline!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  merchantId!: string;
}
