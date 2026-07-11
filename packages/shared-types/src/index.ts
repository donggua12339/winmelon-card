/**
 * 前后端共享类型与枚举
 */

// ============================================================
// 用户与权限
// ============================================================
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  MERCHANT = 'MERCHANT',
  STAFF = 'STAFF',
}

export enum MerchantStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
}

// ============================================================
// 商品
// ============================================================
export enum ProductStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  SOLD_OUT = 'SOLD_OUT',
}

export enum StockCardStatus {
  AVAILABLE = 'AVAILABLE',
  LOCKED = 'LOCKED',
  SOLD = 'SOLD',
  DISABLED = 'DISABLED',
}

// ============================================================
// 订单
// ============================================================
export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  DELIVERED = 'DELIVERED',
  EXPIRED = 'EXPIRED',
  REFUNDED = 'REFUNDED',
  CLOSED = 'CLOSED',
}

// ============================================================
// 支付
// ============================================================
export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentChannelCode {
  EPAY = 'epay',
  WECHAT = 'wechat',
  ALIPAY = 'alipay',
  USDT = 'usdt',
}

// ============================================================
// 统一 API 响应格式
// ============================================================
export interface ApiResponse<T = unknown> {
  code: 'OK' | string;
  data: T;
  message?: string;
  requestId?: string;
}

// ============================================================
// 分页
// ============================================================
export interface PageQuery {
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
