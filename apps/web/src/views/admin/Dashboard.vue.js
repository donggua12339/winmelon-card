import { ref, onMounted } from 'vue';
import { get } from '@/api/http';
const stats = ref([
    { label: '今日订单', value: '-', icon: '🛒', glow: 'glow-purple' },
    { label: '今日 GMV', value: '-', icon: '💰', glow: 'glow-cyan' },
    { label: '商品总数', value: '-', icon: '📦', glow: 'glow-pink' },
    { label: '订单总数', value: '-', icon: '📊', glow: 'glow-purple' },
]);
const loading = ref(false);
async function fetchStats() {
    loading.value = true;
    try {
        const [products, orders] = await Promise.all([
            get('/admin/products', { params: { pageSize: 1 } }),
            get('/admin/orders', { params: { pageSize: 100 } }),
        ]);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayOrders = orders.items.filter((o) => new Date(o.createdAt) >= today);
        const todayGmv = todayOrders
            .filter((o) => o.status === 'PAID' || o.status === 'DELIVERED')
            .reduce((sum, o) => sum + Number(o.totalAmount), 0);
        stats.value = [
            { label: '今日订单', value: String(todayOrders.length), icon: '🛒', glow: 'glow-purple' },
            { label: '今日 GMV', value: `¥${todayGmv.toFixed(2)}`, icon: '💰', glow: 'glow-cyan' },
            { label: '商品总数', value: String(products.total), icon: '📦', glow: 'glow-pink' },
            { label: '订单总数', value: String(orders.total), icon: '📊', glow: 'glow-purple' },
        ];
    }
    finally {
        loading.value = false;
    }
}
onMounted(fetchStats);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['action-card']} */ ;
/** @type {__VLS_StyleScopedClasses['status-row']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "dashboard" },
});
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "page-desc" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stats-grid" },
});
for (const [s, i] of __VLS_getVForSourceType((__VLS_ctx.stats))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (i),
        ...{ class: "glass stat-card" },
        ...{ class: (s.glow) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-icon" },
    });
    (s.icon);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-info" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-label" },
    });
    (s.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-value num-highlight" },
    });
    (s.value);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "section-title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "actions-grid" },
});
const __VLS_0 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    to: "/admin/products",
    ...{ class: "glass action-card" },
}));
const __VLS_2 = __VLS_1({
    to: "/admin/products",
    ...{ class: "glass action-card" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "action-icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "action-text" },
});
var __VLS_3;
const __VLS_4 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    to: "/admin/stock",
    ...{ class: "glass action-card" },
}));
const __VLS_6 = __VLS_5({
    to: "/admin/stock",
    ...{ class: "glass action-card" },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "action-icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "action-text" },
});
var __VLS_7;
const __VLS_8 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    to: "/admin/orders",
    ...{ class: "glass action-card" },
}));
const __VLS_10 = __VLS_9({
    to: "/admin/orders",
    ...{ class: "glass action-card" },
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "action-icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "action-text" },
});
var __VLS_11;
const __VLS_12 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    to: "/admin/payments",
    ...{ class: "glass action-card" },
}));
const __VLS_14 = __VLS_13({
    to: "/admin/payments",
    ...{ class: "glass action-card" },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "action-icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "action-text" },
});
var __VLS_15;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "section-title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "glass status-card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "status-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "status-name" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "status-badge online" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "status-dot online" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "status-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "status-name" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "status-badge online" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "status-dot online" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "status-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "status-name" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "status-badge online" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "status-dot online" },
});
/** @type {__VLS_StyleScopedClasses['dashboard']} */ ;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['page-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['glass']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-info']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['num-highlight']} */ ;
/** @type {__VLS_StyleScopedClasses['section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['actions-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['glass']} */ ;
/** @type {__VLS_StyleScopedClasses['action-card']} */ ;
/** @type {__VLS_StyleScopedClasses['action-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['action-text']} */ ;
/** @type {__VLS_StyleScopedClasses['glass']} */ ;
/** @type {__VLS_StyleScopedClasses['action-card']} */ ;
/** @type {__VLS_StyleScopedClasses['action-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['action-text']} */ ;
/** @type {__VLS_StyleScopedClasses['glass']} */ ;
/** @type {__VLS_StyleScopedClasses['action-card']} */ ;
/** @type {__VLS_StyleScopedClasses['action-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['action-text']} */ ;
/** @type {__VLS_StyleScopedClasses['glass']} */ ;
/** @type {__VLS_StyleScopedClasses['action-card']} */ ;
/** @type {__VLS_StyleScopedClasses['action-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['action-text']} */ ;
/** @type {__VLS_StyleScopedClasses['section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['glass']} */ ;
/** @type {__VLS_StyleScopedClasses['status-card']} */ ;
/** @type {__VLS_StyleScopedClasses['status-row']} */ ;
/** @type {__VLS_StyleScopedClasses['status-name']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['online']} */ ;
/** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['online']} */ ;
/** @type {__VLS_StyleScopedClasses['status-row']} */ ;
/** @type {__VLS_StyleScopedClasses['status-name']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['online']} */ ;
/** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['online']} */ ;
/** @type {__VLS_StyleScopedClasses['status-row']} */ ;
/** @type {__VLS_StyleScopedClasses['status-name']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['online']} */ ;
/** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['online']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            stats: stats,
            loading: loading,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
