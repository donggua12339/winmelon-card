import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
import 'element-plus/dist/index.css';
import './styles/theme.scss';
import App from './App.vue';
import router from './router';
import { initWebSentry } from './common/sentry';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });

// M2: Sentry 错误 + 性能监控（在 mount 前初始化一次即可）
initWebSentry(app);
app.mount('#app');
