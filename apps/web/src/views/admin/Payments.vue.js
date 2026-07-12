import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { get, put } from '@/api/http';
const loading = ref(false);
const channels = ref([]);
const editVisible = ref(false);
const editForm = reactive({
    code: '',
    name: '',
    isAvailable: false,
    config: '',
});
const saving = ref(false);
async function fetchChannels() {
    loading.value = true;
    try {
        channels.value = await get('/admin/payment-channels');
    }
    finally {
        loading.value = false;
    }
}
async function openEdit(code) {
    const detail = await get(`/admin/payment-channels/${code}`);
    editForm.code = detail.code;
    editForm.name = detail.name;
    editForm.isAvailable = detail.isAvailable;
    editForm.config = JSON.stringify(detail.config, null, 2);
    editVisible.value = true;
}
async function onSave() {
    let configObj = {};
    try {
        configObj = editForm.config ? JSON.parse(editForm.config) : {};
    }
    catch {
        ElMessage.error('配置必须是合法 JSON');
        return;
    }
    saving.value = true;
    try {
        await put(`/admin/payment-channels/${editForm.code}`, {
            name: editForm.name,
            isAvailable: editForm.isAvailable,
            config: configObj,
        });
        ElMessage.success('保存成功');
        editVisible.value = false;
        fetchChannels();
    }
    finally {
        saving.value = false;
    }
}
async function toggleAvailable(ch) {
    await put(`/admin/payment-channels/${ch.code}`, { isAvailable: !ch.isAvailable });
    ElMessage.success(ch.isAvailable ? '已禁用' : '已启用');
    fetchChannels();
}
function channelDesc(code) {
    const map = {
        epay: '彩虹易支付，支持支付宝/微信，个人免签约',
        mock: '模拟支付通道，仅用于开发测试',
    };
    return map[code] ?? '';
}
onMounted(fetchChannels);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "payments" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "page-desc" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "channels-grid" },
});
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
for (const [ch] of __VLS_getVForSourceType((__VLS_ctx.channels))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (ch.id),
        ...{ class: "glass channel-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "channel-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "channel-icon" },
    });
    (ch.code === 'epay' ? '🌈' : '🧪');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "channel-info" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "channel-name" },
    });
    (ch.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "channel-code" },
    });
    (ch.code);
    const __VLS_0 = {}.ElSwitch;
    /** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ 'onChange': {} },
        modelValue: (ch.isAvailable),
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onChange': {} },
        modelValue: (ch.isAvailable),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_4;
    let __VLS_5;
    let __VLS_6;
    const __VLS_7 = {
        onChange: (...[$event]) => {
            __VLS_ctx.toggleAvailable(ch);
        }
    };
    var __VLS_3;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "channel-desc" },
    });
    (__VLS_ctx.channelDesc(ch.code));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "channel-footer" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "updated" },
    });
    (new Date(ch.updatedAt).toLocaleString());
    const __VLS_8 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        ...{ 'onClick': {} },
        link: true,
        type: "primary",
    }));
    const __VLS_10 = __VLS_9({
        ...{ 'onClick': {} },
        link: true,
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    let __VLS_12;
    let __VLS_13;
    let __VLS_14;
    const __VLS_15 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openEdit(ch.code);
        }
    };
    __VLS_11.slots.default;
    var __VLS_11;
}
const __VLS_16 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    modelValue: (__VLS_ctx.editVisible),
    title: "通道配置",
    width: "560px",
}));
const __VLS_18 = __VLS_17({
    modelValue: (__VLS_ctx.editVisible),
    title: "通道配置",
    width: "560px",
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_19.slots.default;
const __VLS_20 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    labelPosition: "top",
}));
const __VLS_22 = __VLS_21({
    labelPosition: "top",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_23.slots.default;
const __VLS_24 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    label: "通道名称",
}));
const __VLS_26 = __VLS_25({
    label: "通道名称",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_27.slots.default;
const __VLS_28 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    modelValue: (__VLS_ctx.editForm.name),
}));
const __VLS_30 = __VLS_29({
    modelValue: (__VLS_ctx.editForm.name),
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
var __VLS_27;
const __VLS_32 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    label: "启用状态",
}));
const __VLS_34 = __VLS_33({
    label: "启用状态",
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
__VLS_35.slots.default;
const __VLS_36 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    modelValue: (__VLS_ctx.editForm.isAvailable),
}));
const __VLS_38 = __VLS_37({
    modelValue: (__VLS_ctx.editForm.isAvailable),
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
var __VLS_35;
const __VLS_40 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    label: "配置（JSON）",
}));
const __VLS_42 = __VLS_41({
    label: "配置（JSON）",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_43.slots.default;
const __VLS_44 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    modelValue: (__VLS_ctx.editForm.config),
    type: "textarea",
    rows: (8),
    placeholder: '{"pid":"","key":"","apiDomain":""}',
}));
const __VLS_46 = __VLS_45({
    modelValue: (__VLS_ctx.editForm.config),
    type: "textarea",
    rows: (8),
    placeholder: '{"pid":"","key":"","apiDomain":""}',
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
var __VLS_43;
var __VLS_23;
{
    const { footer: __VLS_thisSlot } = __VLS_19.slots;
    const __VLS_48 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        ...{ 'onClick': {} },
    }));
    const __VLS_50 = __VLS_49({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    let __VLS_52;
    let __VLS_53;
    let __VLS_54;
    const __VLS_55 = {
        onClick: (...[$event]) => {
            __VLS_ctx.editVisible = false;
        }
    };
    __VLS_51.slots.default;
    var __VLS_51;
    const __VLS_56 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }));
    const __VLS_58 = __VLS_57({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    let __VLS_60;
    let __VLS_61;
    let __VLS_62;
    const __VLS_63 = {
        onClick: (__VLS_ctx.onSave)
    };
    __VLS_59.slots.default;
    var __VLS_59;
}
var __VLS_19;
/** @type {__VLS_StyleScopedClasses['payments']} */ ;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['page-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['channels-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['glass']} */ ;
/** @type {__VLS_StyleScopedClasses['channel-card']} */ ;
/** @type {__VLS_StyleScopedClasses['channel-header']} */ ;
/** @type {__VLS_StyleScopedClasses['channel-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['channel-info']} */ ;
/** @type {__VLS_StyleScopedClasses['channel-name']} */ ;
/** @type {__VLS_StyleScopedClasses['channel-code']} */ ;
/** @type {__VLS_StyleScopedClasses['channel-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['channel-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['updated']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            loading: loading,
            channels: channels,
            editVisible: editVisible,
            editForm: editForm,
            saving: saving,
            openEdit: openEdit,
            onSave: onSave,
            toggleAvailable: toggleAvailable,
            channelDesc: channelDesc,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
