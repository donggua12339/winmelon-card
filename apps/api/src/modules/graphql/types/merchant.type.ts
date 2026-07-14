import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class MerchantType {
  @Field(() => ID)
  id!: string;

  @Field()
  code!: string;

  @Field()
  name!: string;

  @Field()
  contactEmail!: string;

  @Field()
  status!: string;

  @Field(() => Float)
  balance!: number;

  @Field(() => Float)
  freezeBalance!: number;

  @Field(() => Float)
  totalWithdrawn!: number;

  @Field({ nullable: true })
  themeColor?: string;

  @Field(() => Int, { nullable: true, description: '返佣比例 ×10000' })
  commissionRate?: number;

  @Field({ nullable: true })
  frozenReason?: string;

  @Field({ nullable: true })
  frozenAt?: Date;
}
