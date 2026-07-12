import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { get, post } from '@/api/http';
const loading = ref(false);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const statusFilter = ref('');
const keyword = ref('');
const detailVisible = ref(false);
const detail = ref(null);
const detailLoading = ref(false);
async function fetchList() {
    loading.value = true;
    try {
        const data = await get('/admin/orders', {
            params: {
                page: page.value,
                pageSize: pageSize.value,
                status: statusFilter.value || undefined,
                keyword: keyword.value || undefined,
            },
        });
        list.value = data.items;
        total.value = data.total;
    }
    finally {
        loading.value = false;
    }
}
async function openDetail(id) {
    detailVisible.value = true;
    detailLoading.value = true;
    try {
        detail.value = await get(`/admin/orders/${id}`);
    }
    finally {
        detailLoading.value = false;
    }
}
async function onRetry(orderId) {
    await ElMessageBox.confirm('确定手动补发卡密？仅适用于已支付但未发卡的订单。', '提示', {
        type: 'warning',
    });
    try {
        const result = await post(`/admin/delivery/${orderId}/retry`);
        ElMessage.success(`补发成功，共 ${result.delivered} 张卡密`);
        if (detail.value?.id === orderId) {
            openDetail(orderId);
        }
        fetchList();
    }
    catch {
        // 错误已由 http 拦截器提示
    }
}
function statusTag(s) {
    const map = {
        PENDING: { type: 'warning', text: '待支付' },
        PAID: { type: 'primary', text: '已支付' },
        DELIVERED: { type: 'success', text: '已发卡' },
        EXPIRED: { type: 'info', text: '已超时' },
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
onMounted(fetchList);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "toolbar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "actions" },
});
const __VLS_0 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onClear': {} },
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.keyword),
    placeholder: "订单号/邮箱",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClear': {} },
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.keyword),
    placeholder: "订单号/邮箱",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
let __VLS_6;
const __VLS_7 = {
    onClear: (__VLS_ctx.fetchList)
};
const __VLS_8 = {
    onKeyup: (__VLS_ctx.fetchList)
};
var __VLS_3;
const __VLS_9 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.statusFilter),
    placeholder: "状态",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_11 = __VLS_10({
    ...{ 'onChange': {} },
    modelValue: (__VLS_ctx.statusFilter),
    placeholder: "状态",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
let __VLS_13;
let __VLS_14;
let __VLS_15;
const __VLS_16 = {
    onChange: (__VLS_ctx.fetchList)
};
__VLS_12.slots.default;
const __VLS_17 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
    label: "待支付",
    value: "PENDING",
}));
const __VLS_19 = __VLS_18({
    label: "待支付",
    value: "PENDING",
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
const __VLS_21 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
    label: "已支付",
    value: "PAID",
}));
const __VLS_23 = __VLS_22({
    label: "已支付",
    value: "PAID",
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
const __VLS_25 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
    label: "已发卡",
    value: "DELIVERED",
}));
const __VLS_27 = __VLS_26({
    label: "已发卡",
    value: "DELIVERED",
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
const __VLS_29 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
    label: "已超时",
    value: "EXPIRED",
}));
const __VLS_31 = __VLS_30({
    label: "已超时",
    value: "EXPIRED",
}, ...__VLS_functionalComponentArgsRest(__VLS_30));
var __VLS_12;
const __VLS_33 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
    ...{ 'onClick': {} },
}));
const __VLS_35 = __VLS_34({
    ...{ 'onClick': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_34));
let __VLS_37;
let __VLS_38;
let __VLS_39;
const __VLS_40 = {
    onClick: (__VLS_ctx.fetchList)
};
__VLS_36.slots.default;
var __VLS_36;
const __VLS_41 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_42 = __VLS_asFunctionalComponent(__VLS_41, new __VLS_41({
    data: (__VLS_ctx.list),
    border: true,
}));
const __VLS_43 = __VLS_42({
    data: (__VLS_ctx.list),
    border: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_42));
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
__VLS_44.slots.default;
const __VLS_45 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
    prop: "orderNo",
    label: "订单号",
    minWidth: "180",
}));
const __VLS_47 = __VLS_46({
    prop: "orderNo",
    label: "订单号",
    minWidth: "180",
}, ...__VLS_functionalComponentArgsRest(__VLS_46));
const __VLS_49 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({
    prop: "buyerEmail",
    label: "买家邮箱",
    minWidth: "180",
}));
const __VLS_51 = __VLS_50({
    prop: "buyerEmail",
    label: "买家邮箱",
    minWidth: "180",
}, ...__VLS_functionalComponentArgsRest(__VLS_50));
const __VLS_53 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({
    label: "商品",
    minWidth: "200",
}));
const __VLS_55 = __VLS_54({
    label: "商品",
    minWidth: "200",
}, ...__VLS_functionalComponentArgsRest(__VLS_54));
__VLS_56.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_56.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    for (const [it, i] of __VLS_getVForSourceType((row.items))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            key: (i),
        });
        (it.productName);
        (it.quantity);
        if (i < row.items.length - 1) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        }
    }
}
var __VLS_56;
const __VLS_57 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({
    prop: "totalAmount",
    label: "金额",
    width: "100",
}));
const __VLS_59 = __VLS_58({
    prop: "totalAmount",
    label: "金额",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_58));
__VLS_60.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_60.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    (row.totalAmount);
}
var __VLS_60;
const __VLS_61 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_62 = __VLS_asFunctionalComponent(__VLS_61, new __VLS_61({
    label: "状态",
    width: "100",
}));
const __VLS_63 = __VLS_62({
    label: "状态",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_62));
__VLS_64.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_64.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_65 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_66 = __VLS_asFunctionalComponent(__VLS_65, new __VLS_65({
        type: __VLS_ctx.statusTag(row.status).type,
    }));
    const __VLS_67 = __VLS_66({
        type: __VLS_ctx.statusTag(row.status).type,
    }, ...__VLS_functionalComponentArgsRest(__VLS_66));
    __VLS_68.slots.default;
    (__VLS_ctx.statusTag(row.status).text);
    var __VLS_68;
}
var __VLS_64;
const __VLS_69 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_70 = __VLS_asFunctionalComponent(__VLS_69, new __VLS_69({
    prop: "createdAt",
    label: "下单时间",
    width: "170",
}));
const __VLS_71 = __VLS_70({
    prop: "createdAt",
    label: "下单时间",
    width: "170",
}, ...__VLS_functionalComponentArgsRest(__VLS_70));
__VLS_72.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_72.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    (__VLS_ctx.formatTime(row.createdAt));
}
var __VLS_72;
const __VLS_73 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_74 = __VLS_asFunctionalComponent(__VLS_73, new __VLS_73({
    label: "操作",
    width: "180",
    fixed: "right",
}));
const __VLS_75 = __VLS_74({
    label: "操作",
    width: "180",
    fixed: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_74));
__VLS_76.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_76.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_77 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_78 = __VLS_asFunctionalComponent(__VLS_77, new __VLS_77({
        ...{ 'onClick': {} },
        link: true,
        type: "primary",
        size: "small",
    }));
    const __VLS_79 = __VLS_78({
        ...{ 'onClick': {} },
        link: true,
        type: "primary",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_78));
    let __VLS_81;
    let __VLS_82;
    let __VLS_83;
    const __VLS_84 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openDetail(row.id);
        }
    };
    __VLS_80.slots.default;
    var __VLS_80;
    if (row.status === 'PAID') {
        const __VLS_85 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_86 = __VLS_asFunctionalComponent(__VLS_85, new __VLS_85({
            ...{ 'onClick': {} },
            link: true,
            type: "warning",
            size: "small",
        }));
        const __VLS_87 = __VLS_86({
            ...{ 'onClick': {} },
            link: true,
            type: "warning",
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_86));
        let __VLS_89;
        let __VLS_90;
        let __VLS_91;
        const __VLS_92 = {
            onClick: (...[$event]) => {
                if (!(row.status === 'PAID'))
                    return;
                __VLS_ctx.onRetry(row.id);
            }
        };
        __VLS_88.slots.default;
        var __VLS_88;
    }
}
var __VLS_76;
var __VLS_44;
const __VLS_93 = {}.ElPagination;
/** @type {[typeof __VLS_components.ElPagination, typeof __VLS_components.elPagination, ]} */ ;
// @ts-ignore
const __VLS_94 = __VLS_asFunctionalComponent(__VLS_93, new __VLS_93({
    ...{ 'onCurrentChange': {} },
    currentPage: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
    layout: "total, prev, pager, next",
    ...{ style: {} },
}));
const __VLS_95 = __VLS_94({
    ...{ 'onCurrentChange': {} },
    currentPage: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
    layout: "total, prev, pager, next",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_94));
let __VLS_97;
let __VLS_98;
let __VLS_99;
const __VLS_100 = {
    onCurrentChange: (__VLS_ctx.fetchList)
};
var __VLS_96;
const __VLS_101 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_102 = __VLS_asFunctionalComponent(__VLS_101, new __VLS_101({
    modelValue: (__VLS_ctx.detailVisible),
    title: "订单详情",
    width: "640px",
}));
const __VLS_103 = __VLS_102({
    modelValue: (__VLS_ctx.detailVisible),
    title: "订单详情",
    width: "640px",
}, ...__VLS_functionalComponentArgsRest(__VLS_102));
__VLS_104.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.detailLoading) }, null, null);
if (__VLS_ctx.detail) {
    const __VLS_105 = {}.ElDescriptions;
    /** @type {[typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, typeof __VLS_components.ElDescriptions, typeof __VLS_components.elDescriptions, ]} */ ;
    // @ts-ignore
    const __VLS_106 = __VLS_asFunctionalComponent(__VLS_105, new __VLS_105({
        column: (2),
        border: true,
    }));
    const __VLS_107 = __VLS_106({
        column: (2),
        border: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_106));
    __VLS_108.slots.default;
    const __VLS_109 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_110 = __VLS_asFunctionalComponent(__VLS_109, new __VLS_109({
        label: "订单号",
    }));
    const __VLS_111 = __VLS_110({
        label: "订单号",
    }, ...__VLS_functionalComponentArgsRest(__VLS_110));
    __VLS_112.slots.default;
    (__VLS_ctx.detail.orderNo);
    var __VLS_112;
    const __VLS_113 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_114 = __VLS_asFunctionalComponent(__VLS_113, new __VLS_113({
        label: "状态",
    }));
    const __VLS_115 = __VLS_114({
        label: "状态",
    }, ...__VLS_functionalComponentArgsRest(__VLS_114));
    __VLS_116.slots.default;
    const __VLS_117 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_118 = __VLS_asFunctionalComponent(__VLS_117, new __VLS_117({
        type: __VLS_ctx.statusTag(__VLS_ctx.detail.status).type,
    }));
    const __VLS_119 = __VLS_118({
        type: __VLS_ctx.statusTag(__VLS_ctx.detail.status).type,
    }, ...__VLS_functionalComponentArgsRest(__VLS_118));
    __VLS_120.slots.default;
    (__VLS_ctx.statusTag(__VLS_ctx.detail.status).text);
    var __VLS_120;
    var __VLS_116;
    const __VLS_121 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_122 = __VLS_asFunctionalComponent(__VLS_121, new __VLS_121({
        label: "买家邮箱",
    }));
    const __VLS_123 = __VLS_122({
        label: "买家邮箱",
    }, ...__VLS_functionalComponentArgsRest(__VLS_122));
    __VLS_124.slots.default;
    (__VLS_ctx.detail.buyerEmail);
    var __VLS_124;
    const __VLS_125 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_126 = __VLS_asFunctionalComponent(__VLS_125, new __VLS_125({
        label: "金额",
    }));
    const __VLS_127 = __VLS_126({
        label: "金额",
    }, ...__VLS_functionalComponentArgsRest(__VLS_126));
    __VLS_128.slots.default;
    (__VLS_ctx.detail.totalAmount);
    var __VLS_128;
    const __VLS_129 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_130 = __VLS_asFunctionalComponent(__VLS_129, new __VLS_129({
        label: "下单时间",
    }));
    const __VLS_131 = __VLS_130({
        label: "下单时间",
    }, ...__VLS_functionalComponentArgsRest(__VLS_130));
    __VLS_132.slots.default;
    (__VLS_ctx.formatTime(__VLS_ctx.detail.createdAt));
    var __VLS_132;
    const __VLS_133 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_134 = __VLS_asFunctionalComponent(__VLS_133, new __VLS_133({
        label: "超时时间",
    }));
    const __VLS_135 = __VLS_134({
        label: "超时时间",
    }, ...__VLS_functionalComponentArgsRest(__VLS_134));
    __VLS_136.slots.default;
    (__VLS_ctx.formatTime(__VLS_ctx.detail.expireAt));
    var __VLS_136;
    const __VLS_137 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_138 = __VLS_asFunctionalComponent(__VLS_137, new __VLS_137({
        label: "支付时间",
    }));
    const __VLS_139 = __VLS_138({
        label: "支付时间",
    }, ...__VLS_functionalComponentArgsRest(__VLS_138));
    __VLS_140.slots.default;
    (__VLS_ctx.formatTime(__VLS_ctx.detail.paidAt));
    var __VLS_140;
    const __VLS_141 = {}.ElDescriptionsItem;
    /** @type {[typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, typeof __VLS_components.ElDescriptionsItem, typeof __VLS_components.elDescriptionsItem, ]} */ ;
    // @ts-ignore
    const __VLS_142 = __VLS_asFunctionalComponent(__VLS_141, new __VLS_141({
        label: "发卡时间",
    }));
    const __VLS_143 = __VLS_142({
        label: "发卡时间",
    }, ...__VLS_functionalComponentArgsRest(__VLS_142));
    __VLS_144.slots.default;
    (__VLS_ctx.formatTime(__VLS_ctx.detail.deliveredAt));
    var __VLS_144;
    var __VLS_108;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
        ...{ style: {} },
    });
    (__VLS_ctx.detail.stockCards.length);
    const __VLS_145 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_146 = __VLS_asFunctionalComponent(__VLS_145, new __VLS_145({
        data: (__VLS_ctx.detail.stockCards),
        border: true,
        size: "small",
    }));
    const __VLS_147 = __VLS_146({
        data: (__VLS_ctx.detail.stockCards),
        border: true,
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_146));
    __VLS_148.slots.default;
    const __VLS_149 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_150 = __VLS_asFunctionalComponent(__VLS_149, new __VLS_149({
        prop: "id",
        label: "卡密ID",
        minWidth: "200",
    }));
    const __VLS_151 = __VLS_150({
        prop: "id",
        label: "卡密ID",
        minWidth: "200",
    }, ...__VLS_functionalComponentArgsRest(__VLS_150));
    const __VLS_153 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_154 = __VLS_asFunctionalComponent(__VLS_153, new __VLS_153({
        prop: "status",
        label: "状态",
        width: "100",
    }));
    const __VLS_155 = __VLS_154({
        prop: "status",
        label: "状态",
        width: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_154));
    var __VLS_148;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
        ...{ style: {} },
    });
    const __VLS_157 = {}.ElTable;
    /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
    // @ts-ignore
    const __VLS_158 = __VLS_asFunctionalComponent(__VLS_157, new __VLS_157({
        data: (__VLS_ctx.detail.payments),
        border: true,
        size: "small",
    }));
    const __VLS_159 = __VLS_158({
        data: (__VLS_ctx.detail.payments),
        border: true,
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_158));
    __VLS_160.slots.default;
    const __VLS_161 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_162 = __VLS_asFunctionalComponent(__VLS_161, new __VLS_161({
        prop: "channel",
        label: "通道",
        width: "100",
    }));
    const __VLS_163 = __VLS_162({
        prop: "channel",
        label: "通道",
        width: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_162));
    const __VLS_165 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_166 = __VLS_asFunctionalComponent(__VLS_165, new __VLS_165({
        prop: "amount",
        label: "金额",
        width: "100",
    }));
    const __VLS_167 = __VLS_166({
        prop: "amount",
        label: "金额",
        width: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_166));
    __VLS_168.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_168.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (row.amount);
    }
    var __VLS_168;
    const __VLS_169 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_170 = __VLS_asFunctionalComponent(__VLS_169, new __VLS_169({
        prop: "status",
        label: "状态",
        width: "100",
    }));
    const __VLS_171 = __VLS_170({
        prop: "status",
        label: "状态",
        width: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_170));
    const __VLS_173 = {}.ElTableColumn;
    /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
    // @ts-ignore
    const __VLS_174 = __VLS_asFunctionalComponent(__VLS_173, new __VLS_173({
        prop: "paidAt",
        label: "支付时间",
    }));
    const __VLS_175 = __VLS_174({
        prop: "paidAt",
        label: "支付时间",
    }, ...__VLS_functionalComponentArgsRest(__VLS_174));
    __VLS_176.slots.default;
    {
        const { default: __VLS_thisSlot } = __VLS_176.slots;
        const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
        (__VLS_ctx.formatTime(row.paidAt));
    }
    var __VLS_176;
    var __VLS_160;
}
{
    const { footer: __VLS_thisSlot } = __VLS_104.slots;
    if (__VLS_ctx.detail?.status === 'PAID') {
        const __VLS_177 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_178 = __VLS_asFunctionalComponent(__VLS_177, new __VLS_177({
            ...{ 'onClick': {} },
            type: "warning",
        }));
        const __VLS_179 = __VLS_178({
            ...{ 'onClick': {} },
            type: "warning",
        }, ...__VLS_functionalComponentArgsRest(__VLS_178));
        let __VLS_181;
        let __VLS_182;
        let __VLS_183;
        const __VLS_184 = {
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.detail?.status === 'PAID'))
                    return;
                __VLS_ctx.onRetry(__VLS_ctx.detail.id);
            }
        };
        __VLS_180.slots.default;
        var __VLS_180;
    }
    const __VLS_185 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_186 = __VLS_asFunctionalComponent(__VLS_185, new __VLS_185({
        ...{ 'onClick': {} },
    }));
    const __VLS_187 = __VLS_186({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_186));
    let __VLS_189;
    let __VLS_190;
    let __VLS_191;
    const __VLS_192 = {
        onClick: (...[$event]) => {
            __VLS_ctx.detailVisible = false;
        }
    };
    __VLS_188.slots.default;
    var __VLS_188;
}
var __VLS_104;
/** @type {__VLS_StyleScopedClasses['toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            loading: loading,
            list: list,
            total: total,
            page: page,
            pageSize: pageSize,
            statusFilter: statusFilter,
            keyword: keyword,
            detailVisible: detailVisible,
            detail: detail,
            detailLoading: detailLoading,
            fetchList: fetchList,
            openDetail: openDetail,
            onRetry: onRetry,
            statusTag: statusTag,
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
