import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { post } from '@/api/http';
const orderNo = ref('');
const email = ref('');
const loading = ref(false);
const order = ref(null);
const copiedIndex = ref(null);
async function onQuery() {
    if (!orderNo.value || !email.value) {
        ElMessage.warning('请填写订单号和邮箱');
        return;
    }
    loading.value = true;
    try {
        order.value = await post('/orders/query', {
            orderNo: orderNo.value.trim(),
            buyerEmail: email.value.trim(),
        });
    }
    catch {
        order.value = null;
    }
    finally {
        loading.value = false;
    }
}
async function copyCard(content, index) {
    await navigator.clipboard.writeText(content);
    copiedIndex.value = index;
    ElMessage.success('已复制');
    setTimeout(() => {
        copiedIndex.value = null;
    }, 1500);
}
function statusLabel(s) {
    const map = {
        PENDING: { type: 'warning', text: '待支付' },
        PAID: { type: 'primary', text: '已支付，发卡中' },
        DELIVERED: { type: 'success', text: '已发卡' },
        EXPIRED: { type: 'info', text: '已超时关闭' },
        REFUNDED: { type: 'info', text: '已退款' },
        CLOSED: { type: 'info', text: '已关闭' },
    };
    return map[s];
}
function formatTime(s) {
    if (!s)
        return '-';
    return new Date(s).toLocaleString();
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['back']} */ ;
/** @type {__VLS_StyleScopedClasses['form-row']} */ ;
/** @type {__VLS_StyleScopedClasses['copy-btn']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "query-page" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "query-container" },
});
const __VLS_0 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    to: "/",
    ...{ class: "back" },
}));
const __VLS_2 = __VLS_1({
    to: "/",
    ...{ class: "back" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "glass query-card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-gradient" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "subtitle" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    ...{ onSubmit: (__VLS_ctx.onQuery) },
    ...{ class: "query-form" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
const __VLS_4 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    modelValue: (__VLS_ctx.orderNo),
    placeholder: "下单时返回的订单号",
    size: "large",
}));
const __VLS_6 = __VLS_5({
    modelValue: (__VLS_ctx.orderNo),
    placeholder: "下单时返回的订单号",
    size: "large",
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
const __VLS_8 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    modelValue: (__VLS_ctx.email),
    placeholder: "下单时填写的邮箱",
    size: "large",
}));
const __VLS_10 = __VLS_9({
    modelValue: (__VLS_ctx.email),
    placeholder: "下单时填写的邮箱",
    size: "large",
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
const __VLS_12 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    type: "primary",
    size: "large",
    loading: (__VLS_ctx.loading),
    nativeType: "submit",
    ...{ class: "submit-btn" },
}));
const __VLS_14 = __VLS_13({
    type: "primary",
    size: "large",
    loading: (__VLS_ctx.loading),
    nativeType: "submit",
    ...{ class: "submit-btn" },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
var __VLS_15;
if (__VLS_ctx.order) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "glass result-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "result-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "order-no-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "order-no" },
    });
    (__VLS_ctx.order.orderNo);
    const __VLS_16 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        type: __VLS_ctx.statusLabel(__VLS_ctx.order.status).type,
        size: "large",
        effect: "dark",
    }));
    const __VLS_18 = __VLS_17({
        type: __VLS_ctx.statusLabel(__VLS_ctx.order.status).type,
        size: "large",
        effect: "dark",
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    __VLS_19.slots.default;
    (__VLS_ctx.statusLabel(__VLS_ctx.order.status).text);
    var __VLS_19;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "info-grid" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "info-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "info-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "info-value price-neon" },
    });
    (__VLS_ctx.order.totalAmount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "info-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "info-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "info-value" },
    });
    (__VLS_ctx.formatTime(__VLS_ctx.order.expireAt));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "info-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "info-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "info-value" },
    });
    (__VLS_ctx.formatTime(__VLS_ctx.order.paidAt));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "info-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "info-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "info-value" },
    });
    (__VLS_ctx.formatTime(__VLS_ctx.order.deliveredAt));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "section-title" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "items-list" },
    });
    for (const [it, i] of __VLS_getVForSourceType((__VLS_ctx.order.items))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (i),
            ...{ class: "item-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "item-name" },
        });
        (it.productName);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "item-qty" },
        });
        (it.quantity);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "item-subtotal" },
        });
        (it.subtotal);
    }
    if (__VLS_ctx.order.cards.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "cards-section" },
        });
        const __VLS_20 = {}.ElAlert;
        /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
            type: "success",
            closable: (false),
            showIcon: true,
            title: "卡密已发出，请妥善保管",
        }));
        const __VLS_22 = __VLS_21({
            type: "success",
            closable: (false),
            showIcon: true,
            title: "卡密已发出，请妥善保管",
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
        for (const [card, i] of __VLS_getVForSourceType((__VLS_ctx.order.cards))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (i),
                ...{ class: "card-item" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card-info" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "card-name" },
            });
            (card.productName);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.code, __VLS_intrinsicElements.code)({
                ...{ class: "card-content" },
            });
            (card.content);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.order))
                            return;
                        if (!(__VLS_ctx.order.cards.length > 0))
                            return;
                        __VLS_ctx.copyCard(card.content, i);
                    } },
                ...{ class: "copy-btn" },
            });
            (__VLS_ctx.copiedIndex === i ? '已复制' : '复制');
        }
    }
    else if (__VLS_ctx.order.status === 'PENDING') {
        const __VLS_24 = {}.ElAlert;
        /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
        // @ts-ignore
        const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
            type: "warning",
            closable: (false),
            showIcon: true,
            title: "订单待支付，请尽快完成支付",
        }));
        const __VLS_26 = __VLS_25({
            type: "warning",
            closable: (false),
            showIcon: true,
            title: "订单待支付，请尽快完成支付",
        }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    }
}
/** @type {__VLS_StyleScopedClasses['query-page']} */ ;
/** @type {__VLS_StyleScopedClasses['query-container']} */ ;
/** @type {__VLS_StyleScopedClasses['back']} */ ;
/** @type {__VLS_StyleScopedClasses['glass']} */ ;
/** @type {__VLS_StyleScopedClasses['query-card']} */ ;
/** @type {__VLS_StyleScopedClasses['title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gradient']} */ ;
/** @type {__VLS_StyleScopedClasses['subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['query-form']} */ ;
/** @type {__VLS_StyleScopedClasses['form-row']} */ ;
/** @type {__VLS_StyleScopedClasses['form-row']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['glass']} */ ;
/** @type {__VLS_StyleScopedClasses['result-card']} */ ;
/** @type {__VLS_StyleScopedClasses['result-header']} */ ;
/** @type {__VLS_StyleScopedClasses['order-no-label']} */ ;
/** @type {__VLS_StyleScopedClasses['order-no']} */ ;
/** @type {__VLS_StyleScopedClasses['info-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['info-item']} */ ;
/** @type {__VLS_StyleScopedClasses['info-label']} */ ;
/** @type {__VLS_StyleScopedClasses['info-value']} */ ;
/** @type {__VLS_StyleScopedClasses['price-neon']} */ ;
/** @type {__VLS_StyleScopedClasses['info-item']} */ ;
/** @type {__VLS_StyleScopedClasses['info-label']} */ ;
/** @type {__VLS_StyleScopedClasses['info-value']} */ ;
/** @type {__VLS_StyleScopedClasses['info-item']} */ ;
/** @type {__VLS_StyleScopedClasses['info-label']} */ ;
/** @type {__VLS_StyleScopedClasses['info-value']} */ ;
/** @type {__VLS_StyleScopedClasses['info-item']} */ ;
/** @type {__VLS_StyleScopedClasses['info-label']} */ ;
/** @type {__VLS_StyleScopedClasses['info-value']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['items-list']} */ ;
/** @type {__VLS_StyleScopedClasses['item-row']} */ ;
/** @type {__VLS_StyleScopedClasses['item-name']} */ ;
/** @type {__VLS_StyleScopedClasses['item-qty']} */ ;
/** @type {__VLS_StyleScopedClasses['item-subtotal']} */ ;
/** @type {__VLS_StyleScopedClasses['cards-section']} */ ;
/** @type {__VLS_StyleScopedClasses['card-item']} */ ;
/** @type {__VLS_StyleScopedClasses['card-info']} */ ;
/** @type {__VLS_StyleScopedClasses['card-name']} */ ;
/** @type {__VLS_StyleScopedClasses['card-content']} */ ;
/** @type {__VLS_StyleScopedClasses['copy-btn']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            orderNo: orderNo,
            email: email,
            loading: loading,
            order: order,
            copiedIndex: copiedIndex,
            onQuery: onQuery,
            copyCard: copyCard,
            statusLabel: statusLabel,
            formatTime: formatTime,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
