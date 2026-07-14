import sanitizeHtml from 'sanitize-html';

/**
 * 商户自定义 HTML 白名单过滤
 * 允许的标签：段落、链接、图片、强调、列表、换行
 * 禁止：script、iframe、on* 事件属性、javascript: 协议
 */
export function sanitizeRichHtml(input: string | null | undefined): string {
  if (!input) return '';
  return sanitizeHtml(input, {
    allowedTags: [
      'p',
      'br',
      'hr',
      'strong',
      'em',
      'b',
      'i',
      'u',
      's',
      'a',
      'img',
      'ul',
      'ol',
      'li',
      'blockquote',
      'code',
      'pre',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'span',
      'div',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      '*': ['class', 'style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
    },
    // 强制 a 标签安全
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    },
    // 禁止所有 data: 外的协议（防 javascript:）
    allowedScriptDomains: [],
    allowedIframeHostnames: [],
    disallowedTagsMode: 'escape',
  });
}

/**
 * 转义 HTML 特殊字符（用于将用户内容作为纯文本显示在 HTML 中）
 * 卡密内容、订单号等不应被解析为 HTML 的场景使用
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
