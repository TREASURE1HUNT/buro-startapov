(() => {
  const safeTags = ['a','blockquote','br','code','del','em','h1','h2','h3','h4','hr','img','li','ol','p','pre','s','strong','table','tbody','td','th','thead','tr','ul','input'];
  const safeAttrs = ['href','src','alt','title','target','rel','class','width','height','align','type','checked','disabled'];
  window.renderStartupMarkdown = source => {
    const text = String(source || '');
    if (!text.trim()) return '';
    if (!window.marked || !window.DOMPurify) return `<p>${text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])).replace(/\n/g,'<br>')}</p>`;
    const html = window.marked.parse(text, { gfm: true, breaks: true, headerIds: false, mangle: false });
    return window.DOMPurify.sanitize(html, { ALLOWED_TAGS: safeTags, ALLOWED_ATTR: safeAttrs, ALLOW_DATA_ATTR: false, FORBID_TAGS: ['script','style','iframe','object','embed','form','svg','math'] });
  };
})();
