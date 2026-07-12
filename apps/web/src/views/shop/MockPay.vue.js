import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { post } from '@/api/http';
const route = useRoute();
const router = useRouter();
const orderNo = route.query.orderNo ?? '';
const amount = route.query.amount ?? '';
const paying = ref(false);
const paid = ref(false);
async function onPay() {
    if (!orderNo) {
        ElMessage.error('订单号缺失');
        return;
    }
    paying.value = true;
    try {
        await post('/payment/mock-pay', { orderNo });
        paid.value = true;
        ElMessage.success('支付成功，2 秒后跳转订单查询页');
        setTimeout(() => {
            router.push({ path: '/query', query: { orderNo } });
        }, 2000);
    }
    finally {
        paying.value = false;
    }
}
onMounted(() => {
    if (!orderNo) {
        ElMessage.error('参数错误');
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['pay-header']} */ ;
/** @type {__VLS_StyleScopedClasses['pay-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['pay-btn']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mock-pay-page" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "glass pay-card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "pay-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "pay-icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "pay-subtitle" },
});
const __VLS_0 = {}.ElAlert;
/** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    type: "warning",
    closable: (false),
    showIcon: true,
    title: "此页面仅用于本地开发与测试，生产环境请关闭 mock 通道",
    ...{ style: {} },
}));
const __VLS_2 = __VLS_1({
    type: "warning",
    closable: (false),
    showIcon: true,
    title: "此页面仅用于本地开发与测试，生产环境请关闭 mock 通道",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "amount-section" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "amount-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "amount" },
});
(__VLS_ctx.amount);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "order-section" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "order-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "order-value" },
});
(__VLS_ctx.orderNo);
if (!__VLS_ctx.paid) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.onPay) },
        ...{ class: "pay-btn" },
        disabled: (__VLS_ctx.paying),
    });
    if (!__VLS_ctx.paying) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.amount);
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "paid-result" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "paid-icon" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "paid-text" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "paid-tip" },
    });
}
/** @type {__VLS_StyleScopedClasses['mock-pay-page']} */ ;
/** @type {__VLS_StyleScopedClasses['glass']} */ ;
/** @type {__VLS_StyleScopedClasses['pay-card']} */ ;
/** @type {__VLS_StyleScopedClasses['pay-header']} */ ;
/** @type {__VLS_StyleScopedClasses['pay-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['pay-subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['amount-section']} */ ;
/** @type {__VLS_StyleScopedClasses['amount-label']} */ ;
/** @type {__VLS_StyleScopedClasses['amount']} */ ;
/** @type {__VLS_StyleScopedClasses['order-section']} */ ;
/** @type {__VLS_StyleScopedClasses['order-label']} */ ;
/** @type {__VLS_StyleScopedClasses['order-value']} */ ;
/** @type {__VLS_StyleScopedClasses['pay-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['paid-result']} */ ;
/** @type {__VLS_StyleScopedClasses['paid-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['paid-text']} */ ;
/** @type {__VLS_StyleScopedClasses['paid-tip']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            orderNo: orderNo,
            amount: amount,
            paying: paying,
            paid: paid,
            onPay: onPay,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
