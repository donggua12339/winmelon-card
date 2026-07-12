import { ref, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { get, post, del } from '@/api/http';
const products = ref([]);
const selectedProductId = ref('');
const loading = ref(false);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(50);
const stats = ref(null);
const importDialogVisible = ref(false);
const importCsvText = ref('');
const importFile = ref(null);
const importing = ref(false);
const importResult = ref(null);
const revealDialogVisible = ref(false);
const revealContent = ref('');
const revealing = ref(false);
async function fetchProducts() {
    const data = await get('/admin/products', { params: { pageSize: 100 } });
    products.value = data.items;
    if (products.value.length && !selectedProductId.value) {
        selectedProductId.value = products.value[0].id;
    }
}
async function fetchList() {
    if (!selectedProductId.value)
        return;
    loading.value = true;
    try {
        const data = await get('/admin/stock', {
            params: { productId: selectedProductId.value, page: page.value, pageSize: pageSize.value },
        });
        list.value = data.items;
        total.value = data.total;
    }
    finally {
        loading.value = false;
    }
}
async function fetchStats() {
    if (!selectedProductId.value)
        return;
    stats.value = await get('/admin/stock/stats', {
        params: { productId: selectedProductId.value },
    });
}
watch(selectedProductId, () => {
    page.value = 1;
    fetchList();
    fetchStats();
});
function openImport() {
    importCsvText.value = '';
    importFile.value = null;
    importResult.value = null;
    importDialogVisible.value = true;
}
function onFileChange(file) {
    // 阻止 el-upload 自动上传，仅读取文件内容
    importFile.value = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        importCsvText.value = String(e.target?.result ?? '');
    };
    reader.readAsText(file);
}
async function onImport() {
    if (!selectedProductId.value)
        return;
    if (!importCsvText.value.trim()) {
        ElMessage.warning('请粘贴 CSV 内容或上传文件');
        return;
    }
    importing.value = true;
    try {
        const result = await post('/admin/stock/import', {
            productId: selectedProductId.value,
            csvContent: importCsvText.value,
        });
        importResult.value = result;
        ElMessage.success(`导入完成：成功 ${result.imported} 条`);
        fetchList();
        fetchStats();
    }
    finally {
        importing.value = false;
    }
}
async function onReveal(row) {
    await ElMessageBox.confirm('查看卡密明文会被审计记录，确定继续？', '安全提示', {
        type: 'warning',
    });
    revealing.value = true;
    try {
        const { content } = await post(`/admin/stock/${row.id}/reveal`);
        revealContent.value = content;
        revealDialogVisible.value = true;
    }
    finally {
        revealing.value = false;
    }
}
async function onDelete(row) {
    await ElMessageBox.confirm('确定删除该卡密？此操作不可恢复。', '危险操作', {
        type: 'error',
        confirmButtonText: '删除',
        confirmButtonClass: 'el-button--danger',
    });
    await del(`/admin/stock/${row.id}`);
    ElMessage.success('已删除');
    fetchList();
    fetchStats();
}
function statusTag(s) {
    const map = {
        AVAILABLE: { type: 'success', text: '可用' },
        LOCKED: { type: 'warning', text: '锁定' },
        SOLD: { type: 'info', text: '已售' },
        DISABLED: { type: 'danger', text: '已禁用' },
    };
    return map[s];
}
async function copyContent() {
    await navigator.clipboard.writeText(revealContent.value);
    ElMessage.success('已复制到剪贴板');
}
onMounted(fetchProducts);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
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
const __VLS_0 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.selectedProductId),
    placeholder: "选择商品",
    ...{ style: {} },
    filterable: true,
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.selectedProductId),
    placeholder: "选择商品",
    ...{ style: {} },
    filterable: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
for (const [p] of __VLS_getVForSourceType((__VLS_ctx.products))) {
    const __VLS_4 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        key: (p.id),
        label: (`${p.name} (可用 ${p.stock.available})`),
        value: (p.id),
    }));
    const __VLS_6 = __VLS_5({
        key: (p.id),
        label: (`${p.name} (可用 ${p.stock.available})`),
        value: (p.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
}
var __VLS_3;
const __VLS_8 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    ...{ 'onClick': {} },
    disabled: (!__VLS_ctx.selectedProductId),
}));
const __VLS_10 = __VLS_9({
    ...{ 'onClick': {} },
    disabled: (!__VLS_ctx.selectedProductId),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
let __VLS_12;
let __VLS_13;
let __VLS_14;
const __VLS_15 = {
    onClick: (__VLS_ctx.fetchList)
};
__VLS_11.slots.default;
var __VLS_11;
const __VLS_16 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    ...{ 'onClick': {} },
    type: "primary",
    disabled: (!__VLS_ctx.selectedProductId),
}));
const __VLS_18 = __VLS_17({
    ...{ 'onClick': {} },
    type: "primary",
    disabled: (!__VLS_ctx.selectedProductId),
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
let __VLS_20;
let __VLS_21;
let __VLS_22;
const __VLS_23 = {
    onClick: (__VLS_ctx.openImport)
};
__VLS_19.slots.default;
var __VLS_19;
if (__VLS_ctx.stats) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stats" },
    });
    const __VLS_24 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        shadow: "hover",
    }));
    const __VLS_26 = __VLS_25({
        shadow: "hover",
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    __VLS_27.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-value success" },
    });
    (__VLS_ctx.stats.available);
    var __VLS_27;
    const __VLS_28 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        shadow: "hover",
    }));
    const __VLS_30 = __VLS_29({
        shadow: "hover",
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    __VLS_31.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-value warning" },
    });
    (__VLS_ctx.stats.locked);
    var __VLS_31;
    const __VLS_32 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        shadow: "hover",
    }));
    const __VLS_34 = __VLS_33({
        shadow: "hover",
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_35.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-value info" },
    });
    (__VLS_ctx.stats.sold);
    var __VLS_35;
    const __VLS_36 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        shadow: "hover",
    }));
    const __VLS_38 = __VLS_37({
        shadow: "hover",
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    __VLS_39.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-value danger" },
    });
    (__VLS_ctx.stats.disabled);
    var __VLS_39;
    const __VLS_40 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        shadow: "hover",
    }));
    const __VLS_42 = __VLS_41({
        shadow: "hover",
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    __VLS_43.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "stat-value" },
    });
    (__VLS_ctx.stats.total);
    var __VLS_43;
}
const __VLS_44 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    data: (__VLS_ctx.list),
    border: true,
    ...{ style: {} },
}));
const __VLS_46 = __VLS_45({
    data: (__VLS_ctx.list),
    border: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
__VLS_47.slots.default;
const __VLS_48 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    prop: "contentPreview",
    label: "卡密指纹",
    minWidth: "180",
}));
const __VLS_50 = __VLS_49({
    prop: "contentPreview",
    label: "卡密指纹",
    minWidth: "180",
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
const __VLS_52 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    label: "状态",
    width: "100",
}));
const __VLS_54 = __VLS_53({
    label: "状态",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
__VLS_55.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_55.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_56 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        type: (__VLS_ctx.statusTag(row.status).type),
    }));
    const __VLS_58 = __VLS_57({
        type: (__VLS_ctx.statusTag(row.status).type),
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    __VLS_59.slots.default;
    (__VLS_ctx.statusTag(row.status).text);
    var __VLS_59;
}
var __VLS_55;
const __VLS_60 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    prop: "orderId",
    label: "订单",
    minWidth: "180",
}));
const __VLS_62 = __VLS_61({
    prop: "orderId",
    label: "订单",
    minWidth: "180",
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
__VLS_63.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_63.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    (row.orderId ?? '-');
}
var __VLS_63;
const __VLS_64 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    prop: "importedAt",
    label: "导入时间",
    width: "170",
}));
const __VLS_66 = __VLS_65({
    prop: "importedAt",
    label: "导入时间",
    width: "170",
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
__VLS_67.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_67.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    (new Date(row.importedAt).toLocaleString());
}
var __VLS_67;
const __VLS_68 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    prop: "soldAt",
    label: "售出时间",
    width: "170",
}));
const __VLS_70 = __VLS_69({
    prop: "soldAt",
    label: "售出时间",
    width: "170",
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
__VLS_71.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_71.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    (row.soldAt ? new Date(row.soldAt).toLocaleString() : '-');
}
var __VLS_71;
const __VLS_72 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    label: "操作",
    width: "170",
    fixed: "right",
}));
const __VLS_74 = __VLS_73({
    label: "操作",
    width: "170",
    fixed: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
__VLS_75.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_75.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_76 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
        ...{ 'onClick': {} },
        link: true,
        type: "primary",
        size: "small",
        disabled: (row.status === 'SOLD'),
        loading: (__VLS_ctx.revealing),
    }));
    const __VLS_78 = __VLS_77({
        ...{ 'onClick': {} },
        link: true,
        type: "primary",
        size: "small",
        disabled: (row.status === 'SOLD'),
        loading: (__VLS_ctx.revealing),
    }, ...__VLS_functionalComponentArgsRest(__VLS_77));
    let __VLS_80;
    let __VLS_81;
    let __VLS_82;
    const __VLS_83 = {
        onClick: (...[$event]) => {
            __VLS_ctx.onReveal(row);
        }
    };
    __VLS_79.slots.default;
    var __VLS_79;
    const __VLS_84 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
        ...{ 'onClick': {} },
        link: true,
        type: "danger",
        size: "small",
        disabled: (row.status === 'SOLD' || row.status === 'LOCKED'),
    }));
    const __VLS_86 = __VLS_85({
        ...{ 'onClick': {} },
        link: true,
        type: "danger",
        size: "small",
        disabled: (row.status === 'SOLD' || row.status === 'LOCKED'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_85));
    let __VLS_88;
    let __VLS_89;
    let __VLS_90;
    const __VLS_91 = {
        onClick: (...[$event]) => {
            __VLS_ctx.onDelete(row);
        }
    };
    __VLS_87.slots.default;
    var __VLS_87;
}
var __VLS_75;
var __VLS_47;
const __VLS_92 = {}.ElPagination;
/** @type {[typeof __VLS_components.ElPagination, typeof __VLS_components.elPagination, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    ...{ 'onCurrentChange': {} },
    currentPage: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
    layout: "total, prev, pager, next",
    ...{ style: {} },
}));
const __VLS_94 = __VLS_93({
    ...{ 'onCurrentChange': {} },
    currentPage: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
    layout: "total, prev, pager, next",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
let __VLS_96;
let __VLS_97;
let __VLS_98;
const __VLS_99 = {
    onCurrentChange: (__VLS_ctx.fetchList)
};
var __VLS_95;
const __VLS_100 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    modelValue: (__VLS_ctx.importDialogVisible),
    title: "批量导入卡密",
    width: "640px",
}));
const __VLS_102 = __VLS_101({
    modelValue: (__VLS_ctx.importDialogVisible),
    title: "批量导入卡密",
    width: "640px",
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
__VLS_103.slots.default;
const __VLS_104 = {}.ElAlert;
/** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
    type: "info",
    closable: (false),
    showIcon: true,
    title: "每行一条卡密，支持双引号包裹；单次最多 5000 条，单条最长 4096 字符",
    ...{ style: {} },
}));
const __VLS_106 = __VLS_105({
    type: "info",
    closable: (false),
    showIcon: true,
    title: "每行一条卡密，支持双引号包裹；单次最多 5000 条，单条最长 4096 字符",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
const __VLS_108 = {}.ElUpload;
/** @type {[typeof __VLS_components.ElUpload, typeof __VLS_components.elUpload, typeof __VLS_components.ElUpload, typeof __VLS_components.elUpload, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    autoUpload: (false),
    showFileList: (false),
    accept: ".csv,.txt",
    onChange: (__VLS_ctx.onFileChange),
}));
const __VLS_110 = __VLS_109({
    autoUpload: (false),
    showFileList: (false),
    accept: ".csv,.txt",
    onChange: (__VLS_ctx.onFileChange),
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
__VLS_111.slots.default;
const __VLS_112 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({}));
const __VLS_114 = __VLS_113({}, ...__VLS_functionalComponentArgsRest(__VLS_113));
__VLS_115.slots.default;
var __VLS_115;
{
    const { tip: __VLS_thisSlot } = __VLS_111.slots;
    if (__VLS_ctx.importFile) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ style: {} },
        });
        (__VLS_ctx.importFile.name);
    }
}
var __VLS_111;
const __VLS_116 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
    modelValue: (__VLS_ctx.importCsvText),
    type: "textarea",
    rows: (10),
    placeholder: "或直接粘贴 CSV 内容",
    ...{ style: {} },
}));
const __VLS_118 = __VLS_117({
    modelValue: (__VLS_ctx.importCsvText),
    type: "textarea",
    rows: (10),
    placeholder: "或直接粘贴 CSV 内容",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_117));
if (__VLS_ctx.importResult) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    const __VLS_120 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
        type: (__VLS_ctx.importResult.failed > 0 ? 'warning' : 'success'),
        closable: (false),
        showIcon: true,
        title: (`成功 ${__VLS_ctx.importResult.imported} 条，重复 ${__VLS_ctx.importResult.duplicated} 条，失败 ${__VLS_ctx.importResult.failed} 条`),
    }));
    const __VLS_122 = __VLS_121({
        type: (__VLS_ctx.importResult.failed > 0 ? 'warning' : 'success'),
        closable: (false),
        showIcon: true,
        title: (`成功 ${__VLS_ctx.importResult.imported} 条，重复 ${__VLS_ctx.importResult.duplicated} 条，失败 ${__VLS_ctx.importResult.failed} 条`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_121));
    if (__VLS_ctx.importResult.errors.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ style: {} },
        });
        for (const [err, i] of __VLS_getVForSourceType((__VLS_ctx.importResult.errors))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (i),
            });
            (err);
        }
    }
}
{
    const { footer: __VLS_thisSlot } = __VLS_103.slots;
    const __VLS_124 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        ...{ 'onClick': {} },
    }));
    const __VLS_126 = __VLS_125({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    let __VLS_128;
    let __VLS_129;
    let __VLS_130;
    const __VLS_131 = {
        onClick: (...[$event]) => {
            __VLS_ctx.importDialogVisible = false;
        }
    };
    __VLS_127.slots.default;
    var __VLS_127;
    const __VLS_132 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.importing),
    }));
    const __VLS_134 = __VLS_133({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.importing),
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    let __VLS_136;
    let __VLS_137;
    let __VLS_138;
    const __VLS_139 = {
        onClick: (__VLS_ctx.onImport)
    };
    __VLS_135.slots.default;
    var __VLS_135;
}
var __VLS_103;
const __VLS_140 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
    modelValue: (__VLS_ctx.revealDialogVisible),
    title: "卡密明文",
    width: "560px",
}));
const __VLS_142 = __VLS_141({
    modelValue: (__VLS_ctx.revealDialogVisible),
    title: "卡密明文",
    width: "560px",
}, ...__VLS_functionalComponentArgsRest(__VLS_141));
__VLS_143.slots.default;
const __VLS_144 = {}.ElAlert;
/** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    type: "warning",
    closable: (false),
    showIcon: true,
    title: "本次查看已写入审计日志，请勿泄露",
    ...{ style: {} },
}));
const __VLS_146 = __VLS_145({
    type: "warning",
    closable: (false),
    showIcon: true,
    title: "本次查看已写入审计日志，请勿泄露",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
const __VLS_148 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
    modelValue: (__VLS_ctx.revealContent),
    type: "textarea",
    rows: (6),
    readonly: true,
}));
const __VLS_150 = __VLS_149({
    modelValue: (__VLS_ctx.revealContent),
    type: "textarea",
    rows: (6),
    readonly: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_149));
{
    const { footer: __VLS_thisSlot } = __VLS_143.slots;
    const __VLS_152 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
        ...{ 'onClick': {} },
    }));
    const __VLS_154 = __VLS_153({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
    let __VLS_156;
    let __VLS_157;
    let __VLS_158;
    const __VLS_159 = {
        onClick: (__VLS_ctx.copyContent)
    };
    __VLS_155.slots.default;
    var __VLS_155;
    const __VLS_160 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_162 = __VLS_161({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_161));
    let __VLS_164;
    let __VLS_165;
    let __VLS_166;
    const __VLS_167 = {
        onClick: (...[$event]) => {
            __VLS_ctx.revealDialogVisible = false;
        }
    };
    __VLS_163.slots.default;
    var __VLS_163;
}
var __VLS_143;
/** @type {__VLS_StyleScopedClasses['toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
/** @type {__VLS_StyleScopedClasses['stats']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['success']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['warning']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['info']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            products: products,
            selectedProductId: selectedProductId,
            loading: loading,
            list: list,
            total: total,
            page: page,
            pageSize: pageSize,
            stats: stats,
            importDialogVisible: importDialogVisible,
            importCsvText: importCsvText,
            importFile: importFile,
            importing: importing,
            importResult: importResult,
            revealDialogVisible: revealDialogVisible,
            revealContent: revealContent,
            revealing: revealing,
            fetchList: fetchList,
            openImport: openImport,
            onFileChange: onFileChange,
            onImport: onImport,
            onReveal: onReveal,
            onDelete: onDelete,
            statusTag: statusTag,
            copyContent: copyContent,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
