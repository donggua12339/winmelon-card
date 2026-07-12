import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { get, post } from '@/api/http';
const route = useRoute();
const shopCode = route.params.merchantCode;
const shop = ref(null);
const products = ref([]);
const loading = ref(false);
const orderDialogVisible = ref(false);
const selectedProduct = ref(null);
const orderForm = ref({
    buyerEmail: '',
    buyerContact: '',
    quantity: 1,
});
const submitting = ref(false);
async function fetchShop() {
    try {
        shop.value = await get(`/shop/${shopCode}`);
    }
    catch {
        ElMessage.error('店铺不存在或已下线');
    }
}
async function fetchProducts() {
    loading.value = true;
    try {
        const data = await get(`/shop/${shopCode}/products`);
        products.value = data.items;
    }
    finally {
        loading.value = false;
    }
}
function openOrder(product) {
    selectedProduct.value = product;
    orderForm.value = {
        buyerEmail: '',
        buyerContact: '',
        quantity: 1,
    };
    orderDialogVisible.value = true;
}
async function onSubmitOrder() {
    if (!selectedProduct.value)
        return;
    if (!orderForm.value.buyerEmail) {
        ElMessage.warning('请填写邮箱');
        return;
    }
    if (selectedProduct.value.purchaseLimit && orderForm.value.quantity > selectedProduct.value.purchaseLimit) {
        ElMessage.warning(`单次限购 ${selectedProduct.value.purchaseLimit} 件`);
        return;
    }
    submitting.value = true;
    try {
        const idempotencyKey = `${orderForm.value.buyerEmail}_${selectedProduct.value.id}_${orderForm.value.quantity}_${Math.floor(Date.now() / 300000)}`;
        const order = await post(`/shop/${shopCode}/orders`, {
            shopCode,
            buyerEmail: orderForm.value.buyerEmail,
            buyerContact: orderForm.value.buyerContact || undefined,
            idempotencyKey,
            items: [{ productId: selectedProduct.value.id, quantity: orderForm.value.quantity }],
        });
        orderDialogVisible.value = false;
        const pay = await post('/payments', {
            orderId: order.orderId,
            channel: 'mock',
        });
        window.location.href = pay.paymentUrl;
    }
    catch (err) {
        console.error(err);
    }
    finally {
        submitting.value = false;
    }
}
onMounted(() => {
    fetchShop();
    fetchProducts();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['back-link']} */ ;
/** @type {__VLS_StyleScopedClasses['section-header']} */ ;
/** @type {__VLS_StyleScopedClasses['product-card']} */ ;
/** @type {__VLS_StyleScopedClasses['meta-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['meta-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['buy-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['buy-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['shop-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['shop-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['order-row']} */ ;
/** @type {__VLS_StyleScopedClasses['order-row']} */ ;
/** @type {__VLS_StyleScopedClasses['order-row']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "shop" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "shop-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "hero-glow" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "hero-content" },
});
if (__VLS_ctx.shop) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "shop-info" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
        ...{ class: "shop-name" },
    });
    (__VLS_ctx.shop.name);
    if (__VLS_ctx.shop.announcement) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "announcement" },
        });
        (__VLS_ctx.shop.announcement);
    }
}
const __VLS_0 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    to: "/",
    ...{ class: "back-link" },
}));
const __VLS_2 = __VLS_1({
    to: "/",
    ...{ class: "back-link" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({
    ...{ class: "products-section" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "count" },
});
(__VLS_ctx.products.length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "products-grid" },
});
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
if (!__VLS_ctx.loading && __VLS_ctx.products.length === 0) {
    const __VLS_4 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        description: "暂无在售商品",
    }));
    const __VLS_6 = __VLS_5({
        description: "暂无在售商品",
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
}
for (const [p, i] of __VLS_getVForSourceType((__VLS_ctx.products))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (p.id),
        ...{ class: "glass product-card" },
        ...{ style: ({ animationDelay: `${i * 0.08}s` }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "product-main" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "product-name" },
    });
    (p.name);
    if (p.description) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "product-desc" },
        });
        (p.description);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "product-meta" },
    });
    if (p.purchaseLimit) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "meta-tag limit" },
        });
        (p.purchaseLimit);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "meta-tag stock" },
    });
    (p.stock);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "product-footer" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "price-area" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "price" },
    });
    (p.price);
    if (p.originalPrice) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "original" },
        });
        (p.originalPrice);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.openOrder(p);
            } },
        ...{ class: "buy-btn" },
        disabled: (p.stock === 0),
    });
    (p.stock === 0 ? '已售罄' : '立即购买');
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.footer, __VLS_intrinsicElements.footer)({
    ...{ class: "shop-footer" },
});
const __VLS_8 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    to: "/query",
}));
const __VLS_10 = __VLS_9({
    to: "/query",
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
var __VLS_11;
const __VLS_12 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    modelValue: (__VLS_ctx.orderDialogVisible),
    title: "确认订单",
    width: "440px",
    ...{ class: "order-dialog" },
}));
const __VLS_14 = __VLS_13({
    modelValue: (__VLS_ctx.orderDialogVisible),
    title: "确认订单",
    width: "440px",
    ...{ class: "order-dialog" },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "order-product" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "order-product-name" },
});
(__VLS_ctx.selectedProduct?.name);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "order-product-price" },
});
(__VLS_ctx.selectedProduct?.price);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "order-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
const __VLS_16 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    modelValue: (__VLS_ctx.orderForm.quantity),
    min: (1),
    max: (__VLS_ctx.selectedProduct?.purchaseLimit || 99),
}));
const __VLS_18 = __VLS_17({
    modelValue: (__VLS_ctx.orderForm.quantity),
    min: (1),
    max: (__VLS_ctx.selectedProduct?.purchaseLimit || 99),
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "order-row total-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "total-price" },
});
((Number(__VLS_ctx.selectedProduct?.price || 0) * __VLS_ctx.orderForm.quantity).toFixed(2));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "order-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "required" },
});
const __VLS_20 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    modelValue: (__VLS_ctx.orderForm.buyerEmail),
    placeholder: "用于接收卡密和查询订单",
}));
const __VLS_22 = __VLS_21({
    modelValue: (__VLS_ctx.orderForm.buyerEmail),
    placeholder: "用于接收卡密和查询订单",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "order-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
const __VLS_24 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    modelValue: (__VLS_ctx.orderForm.buyerContact),
    placeholder: "可选",
}));
const __VLS_26 = __VLS_25({
    modelValue: (__VLS_ctx.orderForm.buyerContact),
    placeholder: "可选",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
{
    const { footer: __VLS_thisSlot } = __VLS_15.slots;
    const __VLS_28 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        ...{ 'onClick': {} },
    }));
    const __VLS_30 = __VLS_29({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    let __VLS_32;
    let __VLS_33;
    let __VLS_34;
    const __VLS_35 = {
        onClick: (...[$event]) => {
            __VLS_ctx.orderDialogVisible = false;
        }
    };
    __VLS_31.slots.default;
    var __VLS_31;
    const __VLS_36 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.submitting),
    }));
    const __VLS_38 = __VLS_37({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.submitting),
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    let __VLS_40;
    let __VLS_41;
    let __VLS_42;
    const __VLS_43 = {
        onClick: (__VLS_ctx.onSubmitOrder)
    };
    __VLS_39.slots.default;
    var __VLS_39;
}
var __VLS_15;
/** @type {__VLS_StyleScopedClasses['shop']} */ ;
/** @type {__VLS_StyleScopedClasses['shop-header']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-glow']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-content']} */ ;
/** @type {__VLS_StyleScopedClasses['shop-info']} */ ;
/** @type {__VLS_StyleScopedClasses['shop-name']} */ ;
/** @type {__VLS_StyleScopedClasses['announcement']} */ ;
/** @type {__VLS_StyleScopedClasses['back-link']} */ ;
/** @type {__VLS_StyleScopedClasses['products-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-header']} */ ;
/** @type {__VLS_StyleScopedClasses['count']} */ ;
/** @type {__VLS_StyleScopedClasses['products-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['glass']} */ ;
/** @type {__VLS_StyleScopedClasses['product-card']} */ ;
/** @type {__VLS_StyleScopedClasses['product-main']} */ ;
/** @type {__VLS_StyleScopedClasses['product-name']} */ ;
/** @type {__VLS_StyleScopedClasses['product-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['product-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['meta-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['limit']} */ ;
/** @type {__VLS_StyleScopedClasses['meta-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['stock']} */ ;
/** @type {__VLS_StyleScopedClasses['product-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['price-area']} */ ;
/** @type {__VLS_StyleScopedClasses['price']} */ ;
/** @type {__VLS_StyleScopedClasses['original']} */ ;
/** @type {__VLS_StyleScopedClasses['buy-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['shop-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['order-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['order-product']} */ ;
/** @type {__VLS_StyleScopedClasses['order-product-name']} */ ;
/** @type {__VLS_StyleScopedClasses['order-product-price']} */ ;
/** @type {__VLS_StyleScopedClasses['order-row']} */ ;
/** @type {__VLS_StyleScopedClasses['order-row']} */ ;
/** @type {__VLS_StyleScopedClasses['total-row']} */ ;
/** @type {__VLS_StyleScopedClasses['total-price']} */ ;
/** @type {__VLS_StyleScopedClasses['order-row']} */ ;
/** @type {__VLS_StyleScopedClasses['required']} */ ;
/** @type {__VLS_StyleScopedClasses['order-row']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            shop: shop,
            products: products,
            loading: loading,
            orderDialogVisible: orderDialogVisible,
            selectedProduct: selectedProduct,
            orderForm: orderForm,
            submitting: submitting,
            openOrder: openOrder,
            onSubmitOrder: onSubmitOrder,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
