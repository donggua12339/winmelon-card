import { ref, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const formRef = ref();
const loading = ref(false);
const form = reactive({
    username: '',
    password: '',
});
const rules = {
    username: [
        { required: true, message: '请输入用户名', trigger: 'blur' },
        { min: 3, max: 64, message: '用户名长度 3-64', trigger: 'blur' },
    ],
    password: [
        { required: true, message: '请输入密码', trigger: 'blur' },
        {
            validator: (_rule, value, callback) => {
                if (!value)
                    return callback(new Error('请输入密码'));
                if (value.length < 8)
                    return callback(new Error('密码至少 8 位'));
                if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
                    return callback(new Error('密码必须包含字母和数字'));
                }
                callback();
            },
            trigger: 'blur',
        },
    ],
};
async function onSubmit() {
    if (!formRef.value)
        return;
    const valid = await formRef.value.validate().catch(() => false);
    if (!valid)
        return;
    loading.value = true;
    try {
        await auth.login(form.username, form.password);
        const redirect = route.query.redirect || '/admin/dashboard';
        router.replace(redirect);
    }
    finally {
        loading.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['back']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "login-page" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "glass login-card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "brand" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "brand-icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "brand-title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-gradient-aurora" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "brand-subtitle" },
});
const __VLS_0 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onSubmit': {} },
    ref: "formRef",
    model: (__VLS_ctx.form),
    rules: (__VLS_ctx.rules),
    labelPosition: "top",
}));
const __VLS_2 = __VLS_1({
    ...{ 'onSubmit': {} },
    ref: "formRef",
    model: (__VLS_ctx.form),
    rules: (__VLS_ctx.rules),
    labelPosition: "top",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
let __VLS_6;
const __VLS_7 = {
    onSubmit: (__VLS_ctx.onSubmit)
};
/** @type {typeof __VLS_ctx.formRef} */ ;
var __VLS_8 = {};
__VLS_3.slots.default;
const __VLS_10 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
    label: "用户名",
    prop: "username",
}));
const __VLS_12 = __VLS_11({
    label: "用户名",
    prop: "username",
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
__VLS_13.slots.default;
const __VLS_14 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent(__VLS_14, new __VLS_14({
    modelValue: (__VLS_ctx.form.username),
    placeholder: "请输入用户名",
    size: "large",
    autocomplete: "username",
}));
const __VLS_16 = __VLS_15({
    modelValue: (__VLS_ctx.form.username),
    placeholder: "请输入用户名",
    size: "large",
    autocomplete: "username",
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
var __VLS_13;
const __VLS_18 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_19 = __VLS_asFunctionalComponent(__VLS_18, new __VLS_18({
    label: "密码",
    prop: "password",
}));
const __VLS_20 = __VLS_19({
    label: "密码",
    prop: "password",
}, ...__VLS_functionalComponentArgsRest(__VLS_19));
__VLS_21.slots.default;
const __VLS_22 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_23 = __VLS_asFunctionalComponent(__VLS_22, new __VLS_22({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.form.password),
    type: "password",
    placeholder: "请输入密码",
    size: "large",
    showPassword: true,
    autocomplete: "current-password",
}));
const __VLS_24 = __VLS_23({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.form.password),
    type: "password",
    placeholder: "请输入密码",
    size: "large",
    showPassword: true,
    autocomplete: "current-password",
}, ...__VLS_functionalComponentArgsRest(__VLS_23));
let __VLS_26;
let __VLS_27;
let __VLS_28;
const __VLS_29 = {
    onKeyup: (__VLS_ctx.onSubmit)
};
var __VLS_25;
var __VLS_21;
const __VLS_30 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_31 = __VLS_asFunctionalComponent(__VLS_30, new __VLS_30({
    ...{ 'onClick': {} },
    type: "primary",
    size: "large",
    loading: (__VLS_ctx.loading),
    nativeType: "submit",
    ...{ class: "submit-btn" },
}));
const __VLS_32 = __VLS_31({
    ...{ 'onClick': {} },
    type: "primary",
    size: "large",
    loading: (__VLS_ctx.loading),
    nativeType: "submit",
    ...{ class: "submit-btn" },
}, ...__VLS_functionalComponentArgsRest(__VLS_31));
let __VLS_34;
let __VLS_35;
let __VLS_36;
const __VLS_37 = {
    onClick: (__VLS_ctx.onSubmit)
};
__VLS_33.slots.default;
var __VLS_33;
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "footer" },
});
const __VLS_38 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
// @ts-ignore
const __VLS_39 = __VLS_asFunctionalComponent(__VLS_38, new __VLS_38({
    to: "/",
    ...{ class: "back" },
}));
const __VLS_40 = __VLS_39({
    to: "/",
    ...{ class: "back" },
}, ...__VLS_functionalComponentArgsRest(__VLS_39));
__VLS_41.slots.default;
var __VLS_41;
/** @type {__VLS_StyleScopedClasses['login-page']} */ ;
/** @type {__VLS_StyleScopedClasses['glass']} */ ;
/** @type {__VLS_StyleScopedClasses['login-card']} */ ;
/** @type {__VLS_StyleScopedClasses['brand']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gradient-aurora']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['footer']} */ ;
/** @type {__VLS_StyleScopedClasses['back']} */ ;
// @ts-ignore
var __VLS_9 = __VLS_8;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            formRef: formRef,
            loading: loading,
            form: form,
            rules: rules,
            onSubmit: onSubmit,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
