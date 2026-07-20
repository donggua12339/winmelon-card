"""
WM Card OpenAPI Python 客户端示例
依赖：requests >= 2.31
安装：pip install requests
"""

import csv
import io
import time
from typing import Any

import requests


class WmCardClient:
    BASE_URL = "https://winmelon.cn/open/v1"

    def __init__(self, api_key: str, timeout: int = 30):
        if not api_key.startswith("sk_live_"):
            raise ValueError("API Key 必须以 sk_live_ 开头")
        self.api_key = api_key
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update(
            {
                "X-API-Key": api_key,
                "Content-Type": "application/json",
                "User-Agent": "wm-card-python/1.0",
            }
        )

    def _request(self, method: str, path: str, **kwargs) -> dict[str, Any]:
        """发请求 + 简单指数退避重试"""
        url = f"{self.BASE_URL}{path}"
        max_retries = 3
        for attempt in range(max_retries + 1):
            resp = self.session.request(method, url, timeout=self.timeout, **kwargs)
            if resp.status_code == 429 or resp.status_code >= 500:
                if attempt < max_retries:
                    time.sleep(2**attempt)
                    continue
            resp.raise_for_status()
            body = resp.json()
            if body.get("code") != "OK":
                raise RuntimeError(f"API 错误: {body}")
            return body["data"]
        raise RuntimeError("重试次数耗尽")

    # ============== 商品 ==============

    def list_products(
        self,
        keyword: str | None = None,
        status: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        params = {"page": page, "pageSize": page_size}
        if keyword:
            params["keyword"] = keyword
        if status:
            params["status"] = status
        return self._request("GET", "/products", params=params)

    def get_product(self, product_id: str) -> dict:
        return self._request("GET", f"/products/{product_id}")

    def create_product(self, payload: dict) -> dict:
        return self._request("POST", "/products", json=payload)

    def update_product(self, product_id: str, payload: dict) -> dict:
        return self._request("POST", f"/products/{product_id}/update", json=payload)

    # ============== 卡密 ==============

    def list_stock(
        self,
        product_id: str,
        status: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict:
        params = {"productId": product_id, "page": page, "pageSize": page_size}
        if status:
            params["status"] = status
        return self._request("GET", "/stock", params=params)

    def import_stock(self, product_id: str, cards: list[str]) -> dict:
        """导入卡密：cards 是卡密字符串列表，自动转 CSV"""
        buf = io.StringIO()
        writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL)
        for card in cards:
            writer.writerow([card])
        return self._request(
            "POST",
            "/stock/import",
            json={"productId": product_id, "csvContent": buf.getvalue()},
        )

    def stock_stats(self, product_id: str) -> dict:
        return self._request("GET", f"/stock/stats/{product_id}")

    # ============== 订单 ==============

    def list_orders(
        self,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
    ) -> dict:
        params = {"page": page, "pageSize": page_size}
        if status:
            params["status"] = status
        return self._request("GET", "/orders", params=params)

    def get_order(self, order_id: str) -> dict:
        return self._request("GET", f"/orders/{order_id}")


# ============== 使用示例 ==============

if __name__ == "__main__":
    client = WmCardClient(api_key="sk_live_REPLACE_ME")

    # 1. 列商品
    products = client.list_products(status="ONLINE")
    print(f"在线商品: {products['total']} 个")

    # 2. 导入卡密
    cards = ["ABC-DEF-001", "ABC-DEF-002", "ABC-DEF-003"]
    result = client.import_stock("p_01J3X...", cards)
    print(f"导入: {result['imported']} 条")

    # 3. 查订单
    orders = client.list_orders(page=1, page_size=10, status="PAID")
    for o in orders["items"]:
        print(f"订单 {o['id']}: {o.get('amount')} 元")
