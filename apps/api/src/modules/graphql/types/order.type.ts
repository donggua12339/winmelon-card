import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType()
export class OrderItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  productId!: string;

  @Field()
  productName!: string;

  @Field(() => Float)
  unitPrice!: number;

  @Field(() => Float)
  subtotal!: number;

  @Field(() => Float)
  quantity!: number;
}

@ObjectType()
export class OrderType {
  @Field(() => ID)
  id!: string;

  @Field()
  orderNo!: string;

  @Field()
  status!: string;

  @Field(() => Float)
  totalAmount!: number;

  @Field()
  buyerEmail!: string;

  @Field({ nullable: true })
  buyerContact?: string;

  @Field({ nullable: true })
  paidAt?: Date;

  @Field({ nullable: true })
  deliveredAt?: Date;

  @Field({ nullable: true })
  expireAt?: Date;

  @Field()
  createdAt!: Date;

  @Field()
  shopId!: string;

  @Field(() => [OrderItemType])
  items!: OrderItemType[];
}
