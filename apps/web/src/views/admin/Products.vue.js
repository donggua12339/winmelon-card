import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { get, post, put, del } from '@/api/http';
const DEFAULT_SHOP_ID = 'main'; // MVP：先硬编码 main 店铺，后续从店铺选择器取
const loading = ref(false);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');
const dialogVisible = ref(false);
const dialogMode = ref('create');
const formRef = ref();
const submitting = ref(false);
const form = reactive({
    id: '',
    name: '',
    description: '',
    price: 0,
    originalPrice: undefined,
    purchaseLimit: undefined,
    isAutoDelivery: true,
    sort: 0,
});
const rules = {
    name: [
        { required: true, message: '请输入商品名称', trigger: 'blur' },
        { max: 255, message: '名称最长 255', trigger: 'blur' },
    ],
    price: [
        { required: true, message: '请输入价格', trigger: 'blur' },
        {
            validator: (_r, v, cb) => {
                if (v <= 0 || v > 99999.99)
                    return cb(new Error('价格范围 0.01 ~ 99999.99'));
                cb();
            },
            trigger: 'blur',
        },
    ],
};
async function fetchList() {
    loading.value = true;
    try {
        const data = await get('/admin/products', {
            params: { page: page.value, pageSize: pageSize.value, keyword: keyword.value || undefined },
        });
        list.value = data.items;
        total.value = data.total;
    }
    finally {
        loading.value = false;
    }
}
function openCreate() {
    dialogMode.value = 'create';
    Object.assign(form, {
        id: '',
        name: '',
        description: '',
        price: 0,
        originalPrice: undefined,
        purchaseLimit: undefined,
        isAutoDelivery: true,
        sort: 0,
    });
    dialogVisible.value = true;
}
function openEdit(row) {
    dialogMode.value = 'edit';
    Object.assign(form, {
        id: row.id,
        name: row.name,
        description: row.description ?? '',
        price: Number(row.price),
        originalPrice: row.originalPrice ? Number(row.originalPrice) : undefined,
        purchaseLimit: row.purchaseLimit ?? undefined,
        isAutoDelivery: row.isAutoDelivery,
        sort: row.sort,
    });
    dialogVisible.value = true;
}
async function onSubmit() {
    if (!formRef.value)
        return;
    const valid = await formRef.value.validate().catch(() => false);
    if (!valid)
        return;
    submitting.value = true;
    try {
        const payload = {
            name: form.name,
            description: form.description || undefined,
            price: form.price,
            originalPrice: form.originalPrice,
            purchaseLimit: form.purchaseLimit,
            isAutoDelivery: form.isAutoDelivery,
            sort: form.sort,
        };
        if (dialogMode.value === 'create') {
            await post('/admin/products', { ...payload, shopId: DEFAULT_SHOP_ID });
            ElMessage.success('创建成功');
        }
        else {
            await put(`/admin/products/${form.id}`, payload);
            ElMessage.success('更新成功');
        }
        dialogVisible.value = false;
        fetchList();
    }
    finally {
        submitting.value = false;
    }
}
async function toggleStatus(row) {
    const target = row.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    const label = target === 'ONLINE' ? '上架' : '下架';
    await ElMessageBox.confirm(`确定${label}商品「${row.name}」？`, '提示', { type: 'warning' });
    await post(`/admin/products/${row.id}/status`, { status: target });
    ElMessage.success(`${label}成功`);
    fetchList();
}
async function onDelete(row) {
    await ElMessageBox.confirm(`确定删除商品「${row.name}」？此操作不可恢复。`, '危险操作', {
        type: 'error',
        confirmButtonText: '删除',
        confirmButtonClass: 'el-button--danger',
    });
    await del(`/admin/products/${row.id}`);
    ElMessage.success('已删除');
    fetchList();
}
function statusTag(s) {
    if (s === 'ONLINE')
        return { type: 'success', text: '上架中' };
    if (s === 'SOLD_OUT')
        return { type: 'warning', text: '已售罄' };
    return { type: 'info', text: '已下架' };
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
    placeholder: "搜索商品名",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClear': {} },
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.keyword),
    placeholder: "搜索商品名",
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
const __VLS_9 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
    ...{ 'onClick': {} },
}));
const __VLS_11 = __VLS_10({
    ...{ 'onClick': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
let __VLS_13;
let __VLS_14;
let __VLS_15;
const __VLS_16 = {
    onClick: (__VLS_ctx.fetchList)
};
__VLS_12.slots.default;
var __VLS_12;
const __VLS_17 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
    ...{ 'onClick': {} },
    type: "primary",
}));
const __VLS_19 = __VLS_18({
    ...{ 'onClick': {} },
    type: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
let __VLS_21;
let __VLS_22;
let __VLS_23;
const __VLS_24 = {
    onClick: (__VLS_ctx.openCreate)
};
__VLS_20.slots.default;
var __VLS_20;
const __VLS_25 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
    data: (__VLS_ctx.list),
    border: true,
}));
const __VLS_27 = __VLS_26({
    data: (__VLS_ctx.list),
    border: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
__VLS_28.slots.default;
const __VLS_29 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
    prop: "name",
    label: "商品名",
    minWidth: "180",
}));
const __VLS_31 = __VLS_30({
    prop: "name",
    label: "商品名",
    minWidth: "180",
}, ...__VLS_functionalComponentArgsRest(__VLS_30));
const __VLS_33 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
    prop: "price",
    label: "价格(元)",
    width: "100",
}));
const __VLS_35 = __VLS_34({
    prop: "price",
    label: "价格(元)",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_34));
__VLS_36.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_36.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    (row.price);
}
var __VLS_36;
const __VLS_37 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_38 = __VLS_asFunctionalComponent(__VLS_37, new __VLS_37({
    label: "库存",
    width: "140",
}));
const __VLS_39 = __VLS_38({
    label: "库存",
    width: "140",
}, ...__VLS_functionalComponentArgsRest(__VLS_38));
__VLS_40.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_40.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: ({ 'low-stock': row.stock.available === 0 }) },
    });
    (row.stock.available);
    (row.stock.locked);
    (row.stock.sold);
}
var __VLS_40;
const __VLS_41 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_42 = __VLS_asFunctionalComponent(__VLS_41, new __VLS_41({
    label: "状态",
    width: "100",
}));
const __VLS_43 = __VLS_42({
    label: "状态",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_42));
__VLS_44.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_44.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_45 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
        type: (__VLS_ctx.statusTag(row.status).type),
    }));
    const __VLS_47 = __VLS_46({
        type: (__VLS_ctx.statusTag(row.status).type),
    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    __VLS_48.slots.default;
    (__VLS_ctx.statusTag(row.status).text);
    var __VLS_48;
}
var __VLS_44;
const __VLS_49 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({
    prop: "sort",
    label: "排序",
    width: "80",
}));
const __VLS_51 = __VLS_50({
    prop: "sort",
    label: "排序",
    width: "80",
}, ...__VLS_functionalComponentArgsRest(__VLS_50));
const __VLS_53 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({
    prop: "createdAt",
    label: "创建时间",
    width: "170",
}));
const __VLS_55 = __VLS_54({
    prop: "createdAt",
    label: "创建时间",
    width: "170",
}, ...__VLS_functionalComponentArgsRest(__VLS_54));
__VLS_56.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_56.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    (new Date(row.createdAt).toLocaleString());
}
var __VLS_56;
const __VLS_57 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({
    label: "操作",
    width: "220",
    fixed: "right",
}));
const __VLS_59 = __VLS_58({
    label: "操作",
    width: "220",
    fixed: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_58));
__VLS_60.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_60.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_61 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_62 = __VLS_asFunctionalComponent(__VLS_61, new __VLS_61({
        ...{ 'onClick': {} },
        link: true,
        type: "primary",
        size: "small",
    }));
    const __VLS_63 = __VLS_62({
        ...{ 'onClick': {} },
        link: true,
        type: "primary",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_62));
    let __VLS_65;
    let __VLS_66;
    let __VLS_67;
    const __VLS_68 = {
        onClick: (...[$event]) => {
            __VLS_ctx.openEdit(row);
        }
    };
    __VLS_64.slots.default;
    var __VLS_64;
    const __VLS_69 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_70 = __VLS_asFunctionalComponent(__VLS_69, new __VLS_69({
        ...{ 'onClick': {} },
        link: true,
        type: (row.status === 'ONLINE' ? 'warning' : 'success'),
        size: "small",
    }));
    const __VLS_71 = __VLS_70({
        ...{ 'onClick': {} },
        link: true,
        type: (row.status === 'ONLINE' ? 'warning' : 'success'),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_70));
    let __VLS_73;
    let __VLS_74;
    let __VLS_75;
    const __VLS_76 = {
        onClick: (...[$event]) => {
            __VLS_ctx.toggleStatus(row);
        }
    };
    __VLS_72.slots.default;
    (row.status === 'ONLINE' ? '下架' : '上架');
    var __VLS_72;
    const __VLS_77 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_78 = __VLS_asFunctionalComponent(__VLS_77, new __VLS_77({
        ...{ 'onClick': {} },
        link: true,
        type: "danger",
        size: "small",
    }));
    const __VLS_79 = __VLS_78({
        ...{ 'onClick': {} },
        link: true,
        type: "danger",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_78));
    let __VLS_81;
    let __VLS_82;
    let __VLS_83;
    const __VLS_84 = {
        onClick: (...[$event]) => {
            __VLS_ctx.onDelete(row);
        }
    };
    __VLS_80.slots.default;
    var __VLS_80;
}
var __VLS_60;
var __VLS_28;
const __VLS_85 = {}.ElPagination;
/** @type {[typeof __VLS_components.ElPagination, typeof __VLS_components.elPagination, ]} */ ;
// @ts-ignore
const __VLS_86 = __VLS_asFunctionalComponent(__VLS_85, new __VLS_85({
    ...{ 'onCurrentChange': {} },
    currentPage: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
    layout: "total, prev, pager, next",
    ...{ style: {} },
}));
const __VLS_87 = __VLS_86({
    ...{ 'onCurrentChange': {} },
    currentPage: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
    layout: "total, prev, pager, next",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_86));
let __VLS_89;
let __VLS_90;
let __VLS_91;
const __VLS_92 = {
    onCurrentChange: (__VLS_ctx.fetchList)
};
var __VLS_88;
const __VLS_93 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_94 = __VLS_asFunctionalComponent(__VLS_93, new __VLS_93({
    modelValue: (__VLS_ctx.dialogVisible),
    title: (__VLS_ctx.dialogMode === 'create' ? '新建商品' : '编辑商品'),
    width: "560px",
}));
const __VLS_95 = __VLS_94({
    modelValue: (__VLS_ctx.dialogVisible),
    title: (__VLS_ctx.dialogMode === 'create' ? '新建商品' : '编辑商品'),
    width: "560px",
}, ...__VLS_functionalComponentArgsRest(__VLS_94));
__VLS_96.slots.default;
const __VLS_97 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_98 = __VLS_asFunctionalComponent(__VLS_97, new __VLS_97({
    ref: "formRef",
    model: (__VLS_ctx.form),
    rules: (__VLS_ctx.rules),
    labelWidth: "100px",
}));
const __VLS_99 = __VLS_98({
    ref: "formRef",
    model: (__VLS_ctx.form),
    rules: (__VLS_ctx.rules),
    labelWidth: "100px",
}, ...__VLS_functionalComponentArgsRest(__VLS_98));
/** @type {typeof __VLS_ctx.formRef} */ ;
var __VLS_101 = {};
__VLS_100.slots.default;
const __VLS_103 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_104 = __VLS_asFunctionalComponent(__VLS_103, new __VLS_103({
    label: "商品名",
    prop: "name",
}));
const __VLS_105 = __VLS_104({
    label: "商品名",
    prop: "name",
}, ...__VLS_functionalComponentArgsRest(__VLS_104));
__VLS_106.slots.default;
const __VLS_107 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_108 = __VLS_asFunctionalComponent(__VLS_107, new __VLS_107({
    modelValue: (__VLS_ctx.form.name),
    maxlength: "255",
    showWordLimit: true,
}));
const __VLS_109 = __VLS_108({
    modelValue: (__VLS_ctx.form.name),
    maxlength: "255",
    showWordLimit: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_108));
var __VLS_106;
const __VLS_111 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_112 = __VLS_asFunctionalComponent(__VLS_111, new __VLS_111({
    label: "价格(元)",
    prop: "price",
}));
const __VLS_113 = __VLS_112({
    label: "价格(元)",
    prop: "price",
}, ...__VLS_functionalComponentArgsRest(__VLS_112));
__VLS_114.slots.default;
const __VLS_115 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_116 = __VLS_asFunctionalComponent(__VLS_115, new __VLS_115({
    modelValue: (__VLS_ctx.form.price),
    min: (0.01),
    max: (99999.99),
    precision: (2),
}));
const __VLS_117 = __VLS_116({
    modelValue: (__VLS_ctx.form.price),
    min: (0.01),
    max: (99999.99),
    precision: (2),
}, ...__VLS_functionalComponentArgsRest(__VLS_116));
var __VLS_114;
const __VLS_119 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_120 = __VLS_asFunctionalComponent(__VLS_119, new __VLS_119({
    label: "原价(元)",
}));
const __VLS_121 = __VLS_120({
    label: "原价(元)",
}, ...__VLS_functionalComponentArgsRest(__VLS_120));
__VLS_122.slots.default;
const __VLS_123 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_124 = __VLS_asFunctionalComponent(__VLS_123, new __VLS_123({
    modelValue: (__VLS_ctx.form.originalPrice),
    min: (0.01),
    max: (99999.99),
    precision: (2),
    placeholder: "可选",
}));
const __VLS_125 = __VLS_124({
    modelValue: (__VLS_ctx.form.originalPrice),
    min: (0.01),
    max: (99999.99),
    precision: (2),
    placeholder: "可选",
}, ...__VLS_functionalComponentArgsRest(__VLS_124));
var __VLS_122;
const __VLS_127 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_128 = __VLS_asFunctionalComponent(__VLS_127, new __VLS_127({
    label: "单次限购",
}));
const __VLS_129 = __VLS_128({
    label: "单次限购",
}, ...__VLS_functionalComponentArgsRest(__VLS_128));
__VLS_130.slots.default;
const __VLS_131 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_132 = __VLS_asFunctionalComponent(__VLS_131, new __VLS_131({
    modelValue: (__VLS_ctx.form.purchaseLimit),
    min: (1),
    max: (9999),
    placeholder: "可选",
}));
const __VLS_133 = __VLS_132({
    modelValue: (__VLS_ctx.form.purchaseLimit),
    min: (1),
    max: (9999),
    placeholder: "可选",
}, ...__VLS_functionalComponentArgsRest(__VLS_132));
var __VLS_130;
const __VLS_135 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_136 = __VLS_asFunctionalComponent(__VLS_135, new __VLS_135({
    label: "自动发货",
}));
const __VLS_137 = __VLS_136({
    label: "自动发货",
}, ...__VLS_functionalComponentArgsRest(__VLS_136));
__VLS_138.slots.default;
const __VLS_139 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_140 = __VLS_asFunctionalComponent(__VLS_139, new __VLS_139({
    modelValue: (__VLS_ctx.form.isAutoDelivery),
}));
const __VLS_141 = __VLS_140({
    modelValue: (__VLS_ctx.form.isAutoDelivery),
}, ...__VLS_functionalComponentArgsRest(__VLS_140));
var __VLS_138;
const __VLS_143 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_144 = __VLS_asFunctionalComponent(__VLS_143, new __VLS_143({
    label: "排序",
}));
const __VLS_145 = __VLS_144({
    label: "排序",
}, ...__VLS_functionalComponentArgsRest(__VLS_144));
__VLS_146.slots.default;
const __VLS_147 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_148 = __VLS_asFunctionalComponent(__VLS_147, new __VLS_147({
    modelValue: (__VLS_ctx.form.sort),
    min: (0),
    max: (99999),
}));
const __VLS_149 = __VLS_148({
    modelValue: (__VLS_ctx.form.sort),
    min: (0),
    max: (99999),
}, ...__VLS_functionalComponentArgsRest(__VLS_148));
var __VLS_146;
const __VLS_151 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_152 = __VLS_asFunctionalComponent(__VLS_151, new __VLS_151({
    label: "描述",
}));
const __VLS_153 = __VLS_152({
    label: "描述",
}, ...__VLS_functionalComponentArgsRest(__VLS_152));
__VLS_154.slots.default;
const __VLS_155 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_156 = __VLS_asFunctionalComponent(__VLS_155, new __VLS_155({
    modelValue: (__VLS_ctx.form.description),
    type: "textarea",
    rows: (4),
    maxlength: "65535",
}));
const __VLS_157 = __VLS_156({
    modelValue: (__VLS_ctx.form.description),
    type: "textarea",
    rows: (4),
    maxlength: "65535",
}, ...__VLS_functionalComponentArgsRest(__VLS_156));
var __VLS_154;
var __VLS_100;
{
    const { footer: __VLS_thisSlot } = __VLS_96.slots;
    const __VLS_159 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_160 = __VLS_asFunctionalComponent(__VLS_159, new __VLS_159({
        ...{ 'onClick': {} },
    }));
    const __VLS_161 = __VLS_160({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_160));
    let __VLS_163;
    let __VLS_164;
    let __VLS_165;
    const __VLS_166 = {
        onClick: (...[$event]) => {
            __VLS_ctx.dialogVisible = false;
        }
    };
    __VLS_162.slots.default;
    var __VLS_162;
    const __VLS_167 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_168 = __VLS_asFunctionalComponent(__VLS_167, new __VLS_167({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.submitting),
    }));
    const __VLS_169 = __VLS_168({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.submitting),
    }, ...__VLS_functionalComponentArgsRest(__VLS_168));
    let __VLS_171;
    let __VLS_172;
    let __VLS_173;
    const __VLS_174 = {
        onClick: (__VLS_ctx.onSubmit)
    };
    __VLS_170.slots.default;
    var __VLS_170;
}
var __VLS_96;
/** @type {__VLS_StyleScopedClasses['toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
// @ts-ignore
var __VLS_102 = __VLS_101;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            loading: loading,
            list: list,
            total: total,
            page: page,
            pageSize: pageSize,
            keyword: keyword,
            dialogVisible: dialogVisible,
            dialogMode: dialogMode,
            formRef: formRef,
            submitting: submitting,
            form: form,
            rules: rules,
            fetchList: fetchList,
            openCreate: openCreate,
            openEdit: openEdit,
            onSubmit: onSubmit,
            toggleStatus: toggleStatus,
            onDelete: onDelete,
            statusTag: statusTag,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
