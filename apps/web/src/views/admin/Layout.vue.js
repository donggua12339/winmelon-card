import { RouterView, RouterLink, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { ElMessageBox } from 'element-plus';
const router = useRouter();
const auth = useAuthStore();
async function onLogout() {
    await ElMessageBox.confirm('确定退出登录？', '提示', { type: 'warning' });
    await auth.logout();
    router.replace('/admin/login');
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['side-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['side-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['el-menu-item']} */ ;
/** @type {__VLS_StyleScopedClasses['side-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['el-menu-item']} */ ;
/** @type {__VLS_StyleScopedClasses['back']} */ ;
// CSS variable injection 
// CSS variable injection end 
const __VLS_0 = {}.ElContainer;
/** @type {[typeof __VLS_components.ElContainer, typeof __VLS_components.elContainer, typeof __VLS_components.ElContainer, typeof __VLS_components.elContainer, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "layout" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "layout" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_4 = {};
__VLS_3.slots.default;
const __VLS_5 = {}.ElAside;
/** @type {[typeof __VLS_components.ElAside, typeof __VLS_components.elAside, typeof __VLS_components.ElAside, typeof __VLS_components.elAside, ]} */ ;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
    width: "220px",
    ...{ class: "aside" },
}));
const __VLS_7 = __VLS_6({
    width: "220px",
    ...{ class: "aside" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_8.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "logo" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "logo-icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "logo-text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-gradient-aurora" },
});
const __VLS_9 = {}.ElMenu;
/** @type {[typeof __VLS_components.ElMenu, typeof __VLS_components.elMenu, typeof __VLS_components.ElMenu, typeof __VLS_components.elMenu, ]} */ ;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
    router: true,
    defaultActive: "/admin/dashboard",
    ...{ class: "side-menu" },
}));
const __VLS_11 = __VLS_10({
    router: true,
    defaultActive: "/admin/dashboard",
    ...{ class: "side-menu" },
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
__VLS_12.slots.default;
const __VLS_13 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
    index: "/admin/dashboard",
}));
const __VLS_15 = __VLS_14({
    index: "/admin/dashboard",
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
__VLS_16.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
var __VLS_16;
const __VLS_17 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
    index: "/admin/products",
}));
const __VLS_19 = __VLS_18({
    index: "/admin/products",
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
__VLS_20.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
var __VLS_20;
const __VLS_21 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
    index: "/admin/stock",
}));
const __VLS_23 = __VLS_22({
    index: "/admin/stock",
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
__VLS_24.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
var __VLS_24;
const __VLS_25 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
    index: "/admin/orders",
}));
const __VLS_27 = __VLS_26({
    index: "/admin/orders",
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
__VLS_28.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
var __VLS_28;
const __VLS_29 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
    index: "/admin/payments",
}));
const __VLS_31 = __VLS_30({
    index: "/admin/payments",
}, ...__VLS_functionalComponentArgsRest(__VLS_30));
__VLS_32.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
var __VLS_32;
const __VLS_33 = {}.ElMenuItem;
/** @type {[typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, typeof __VLS_components.ElMenuItem, typeof __VLS_components.elMenuItem, ]} */ ;
// @ts-ignore
const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
    index: "/admin/system",
}));
const __VLS_35 = __VLS_34({
    index: "/admin/system",
}, ...__VLS_functionalComponentArgsRest(__VLS_34));
__VLS_36.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
var __VLS_36;
var __VLS_12;
var __VLS_8;
const __VLS_37 = {}.ElContainer;
/** @type {[typeof __VLS_components.ElContainer, typeof __VLS_components.elContainer, typeof __VLS_components.ElContainer, typeof __VLS_components.elContainer, ]} */ ;
// @ts-ignore
const __VLS_38 = __VLS_asFunctionalComponent(__VLS_37, new __VLS_37({}));
const __VLS_39 = __VLS_38({}, ...__VLS_functionalComponentArgsRest(__VLS_38));
__VLS_40.slots.default;
const __VLS_41 = {}.ElHeader;
/** @type {[typeof __VLS_components.ElHeader, typeof __VLS_components.elHeader, typeof __VLS_components.ElHeader, typeof __VLS_components.elHeader, ]} */ ;
// @ts-ignore
const __VLS_42 = __VLS_asFunctionalComponent(__VLS_41, new __VLS_41({
    ...{ class: "header" },
}));
const __VLS_43 = __VLS_42({
    ...{ class: "header" },
}, ...__VLS_functionalComponentArgsRest(__VLS_42));
__VLS_44.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "left" },
});
const __VLS_45 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
// @ts-ignore
const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
    to: "/",
    ...{ class: "back" },
}));
const __VLS_47 = __VLS_46({
    to: "/",
    ...{ class: "back" },
}, ...__VLS_functionalComponentArgsRest(__VLS_46));
__VLS_48.slots.default;
var __VLS_48;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "user-info" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "user-avatar" },
});
(__VLS_ctx.auth.user?.username?.[0]?.toUpperCase() ?? 'A');
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "user-name" },
});
(__VLS_ctx.auth.user?.username ?? '-');
const __VLS_49 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({
    ...{ 'onClick': {} },
    link: true,
    type: "danger",
}));
const __VLS_51 = __VLS_50({
    ...{ 'onClick': {} },
    link: true,
    type: "danger",
}, ...__VLS_functionalComponentArgsRest(__VLS_50));
let __VLS_53;
let __VLS_54;
let __VLS_55;
const __VLS_56 = {
    onClick: (__VLS_ctx.onLogout)
};
__VLS_52.slots.default;
var __VLS_52;
var __VLS_44;
const __VLS_57 = {}.ElMain;
/** @type {[typeof __VLS_components.ElMain, typeof __VLS_components.elMain, typeof __VLS_components.ElMain, typeof __VLS_components.elMain, ]} */ ;
// @ts-ignore
const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({
    ...{ class: "main" },
}));
const __VLS_59 = __VLS_58({
    ...{ class: "main" },
}, ...__VLS_functionalComponentArgsRest(__VLS_58));
__VLS_60.slots.default;
const __VLS_61 = {}.RouterView;
/** @type {[typeof __VLS_components.RouterView, ]} */ ;
// @ts-ignore
const __VLS_62 = __VLS_asFunctionalComponent(__VLS_61, new __VLS_61({}));
const __VLS_63 = __VLS_62({}, ...__VLS_functionalComponentArgsRest(__VLS_62));
var __VLS_60;
var __VLS_40;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['layout']} */ ;
/** @type {__VLS_StyleScopedClasses['aside']} */ ;
/** @type {__VLS_StyleScopedClasses['logo']} */ ;
/** @type {__VLS_StyleScopedClasses['logo-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['logo-text']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gradient-aurora']} */ ;
/** @type {__VLS_StyleScopedClasses['side-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['header']} */ ;
/** @type {__VLS_StyleScopedClasses['left']} */ ;
/** @type {__VLS_StyleScopedClasses['back']} */ ;
/** @type {__VLS_StyleScopedClasses['right']} */ ;
/** @type {__VLS_StyleScopedClasses['user-info']} */ ;
/** @type {__VLS_StyleScopedClasses['user-avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['user-name']} */ ;
/** @type {__VLS_StyleScopedClasses['main']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            RouterView: RouterView,
            RouterLink: RouterLink,
            auth: auth,
            onLogout: onLogout,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
