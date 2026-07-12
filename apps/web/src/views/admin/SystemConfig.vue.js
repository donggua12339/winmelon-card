import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { get, put } from '@/api/http';
const loading = ref(false);
const saving = ref(false);
const shop = ref(null);
const form = reactive({
    name: '',
    announcement: '',
    footerHtml: '',
    isOnline: true,
});
async function fetchShop() {
    loading.value = true;
    try {
        shop.value = await get('/admin/shops/me');
        form.name = shop.value.name;
        form.announcement = shop.value.announcement ?? '';
        form.footerHtml = shop.value.footerHtml ?? '';
        form.isOnline = shop.value.isOnline;
    }
    finally {
        loading.value = false;
    }
}
async function onSave() {
    if (!shop.value)
        return;
    saving.value = true;
    try {
        const updated = await put(`/admin/shops/${shop.value.id}`, {
            name: form.name,
            announcement: form.announcement || null,
            footerHtml: form.footerHtml || null,
            isOnline: form.isOnline,
        });
        shop.value = updated;
        ElMessage.success('保存成功');
    }
    finally {
        saving.value = false;
    }
}
onMounted(fetchShop);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "config" },
});
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "page-desc" },
});
if (__VLS_ctx.shop) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "glass config-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "info-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "info-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.code, __VLS_intrinsicElements.code)({
        ...{ class: "info-value" },
    });
    (__VLS_ctx.shop.code);
    const __VLS_0 = {}.ElForm;
    /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        labelPosition: "top",
        ...{ class: "form" },
    }));
    const __VLS_2 = __VLS_1({
        labelPosition: "top",
        ...{ class: "form" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_3.slots.default;
    const __VLS_4 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        label: "店铺名称",
    }));
    const __VLS_6 = __VLS_5({
        label: "店铺名称",
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    __VLS_7.slots.default;
    const __VLS_8 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        modelValue: (__VLS_ctx.form.name),
        placeholder: "店铺名称",
        maxlength: "128",
        showWordLimit: true,
    }));
    const __VLS_10 = __VLS_9({
        modelValue: (__VLS_ctx.form.name),
        placeholder: "店铺名称",
        maxlength: "128",
        showWordLimit: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    var __VLS_7;
    const __VLS_12 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        label: "店铺公告",
    }));
    const __VLS_14 = __VLS_13({
        label: "店铺公告",
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    __VLS_15.slots.default;
    const __VLS_16 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        modelValue: (__VLS_ctx.form.announcement),
        type: "textarea",
        rows: (3),
        placeholder: "显示在店铺首页顶部的公告信息",
        maxlength: "500",
        showWordLimit: true,
    }));
    const __VLS_18 = __VLS_17({
        modelValue: (__VLS_ctx.form.announcement),
        type: "textarea",
        rows: (3),
        placeholder: "显示在店铺首页顶部的公告信息",
        maxlength: "500",
        showWordLimit: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    var __VLS_15;
    const __VLS_20 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        label: "底部 HTML（可选）",
    }));
    const __VLS_22 = __VLS_21({
        label: "底部 HTML（可选）",
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_23.slots.default;
    const __VLS_24 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        modelValue: (__VLS_ctx.form.footerHtml),
        type: "textarea",
        rows: (4),
        placeholder: "自定义底部 HTML，如统计代码、客服代码等",
    }));
    const __VLS_26 = __VLS_25({
        modelValue: (__VLS_ctx.form.footerHtml),
        type: "textarea",
        rows: (4),
        placeholder: "自定义底部 HTML，如统计代码、客服代码等",
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "tip" },
    });
    var __VLS_23;
    const __VLS_28 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        label: "店铺状态",
    }));
    const __VLS_30 = __VLS_29({
        label: "店铺状态",
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    __VLS_31.slots.default;
    const __VLS_32 = {}.ElSwitch;
    /** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        modelValue: (__VLS_ctx.form.isOnline),
        activeText: "在线",
        inactiveText: "下线",
    }));
    const __VLS_34 = __VLS_33({
        modelValue: (__VLS_ctx.form.isOnline),
        activeText: "在线",
        inactiveText: "下线",
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "tip" },
    });
    var __VLS_31;
    const __VLS_36 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({}));
    const __VLS_38 = __VLS_37({}, ...__VLS_functionalComponentArgsRest(__VLS_37));
    __VLS_39.slots.default;
    const __VLS_40 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }));
    const __VLS_42 = __VLS_41({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    let __VLS_44;
    let __VLS_45;
    let __VLS_46;
    const __VLS_47 = {
        onClick: (__VLS_ctx.onSave)
    };
    __VLS_43.slots.default;
    var __VLS_43;
    var __VLS_39;
    var __VLS_3;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "info-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "info-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "info-value" },
    });
    (new Date(__VLS_ctx.shop.updatedAt).toLocaleString());
}
/** @type {__VLS_StyleScopedClasses['config']} */ ;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['page-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['glass']} */ ;
/** @type {__VLS_StyleScopedClasses['config-card']} */ ;
/** @type {__VLS_StyleScopedClasses['info-row']} */ ;
/** @type {__VLS_StyleScopedClasses['info-label']} */ ;
/** @type {__VLS_StyleScopedClasses['info-value']} */ ;
/** @type {__VLS_StyleScopedClasses['form']} */ ;
/** @type {__VLS_StyleScopedClasses['tip']} */ ;
/** @type {__VLS_StyleScopedClasses['tip']} */ ;
/** @type {__VLS_StyleScopedClasses['info-row']} */ ;
/** @type {__VLS_StyleScopedClasses['info-label']} */ ;
/** @type {__VLS_StyleScopedClasses['info-value']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            loading: loading,
            saving: saving,
            shop: shop,
            form: form,
            onSave: onSave,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
