(() => {
  const safeTags = ['a','blockquote','br','code','del','em','h1','h2','h3','h4','hr','img','li','ol','p','pre','s','strong','table','tbody','td','th','thead','tr','ul','input'];
  const safeAttrs = ['href','src','alt','title','target','rel','class','width','height','align','type','checked','disabled'];
  window.renderStartupMarkdown = (source, context = {}) => {
    const text = String(source || '');
    if (!text.trim()) return '';
    if (!window.marked || !window.DOMPurify) return `<p>${text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])).replace(/\n/g,'<br>')}</p>`;
    const html = window.marked.parse(text, { gfm: true, breaks: true, headerIds: false, mangle: false });
    const clean = window.DOMPurify.sanitize(html, { ALLOWED_TAGS: safeTags, ALLOWED_ATTR: safeAttrs, ALLOW_DATA_ATTR: false, FORBID_TAGS: ['script','style','iframe','object','embed','form','svg','math'] });
    const githubUrl = context.githubUrl || context.repositoryUrl || context.repoUrl || '';
    const repo = text.match(/https?:\/\/github\.com\/([^/\s)]+\/[^/\s)#?]+)(?:\/blob\/([^/\s)#?]+)\/([^\s)#?]+))?/i)
      || String(githubUrl).match(/(?:https?:\/\/)?github\.com\/([^/\s)]+\/[^/\s)#?]+)(?:\/tree\/([^/\s)#?]+)\/([^\s)#?]+)?/i);
    const repoPath = repo?.[1]?.replace(/\.git$/i, '');
    const branch = repo?.[2] || 'main';
    const basePath = repo?.[3] ? repo[3].split('/').slice(0,-1).join('/') : '';
    const doc = new DOMParser().parseFromString(clean, 'text/html');
    doc.querySelectorAll('img[src]').forEach(image => {
      const source = image.getAttribute('src') || '';
      const blob = source.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/(?:blob|raw)\/([^/]+)\/(.+)$/i);
      if (blob) image.setAttribute('src', `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}`);
      else if (repoPath && !/^(?:[a-z][\w+.-]*:|\/|#|\/\/)/i.test(source)) {
        const relative = [basePath, source.replace(/^\.\//,'').replace(/^(\.\.\/)+/,'')].filter(Boolean).join('/');
        image.setAttribute('src', `https://raw.githubusercontent.com/${repoPath}/${branch}/${relative}`);
      } else if (repoPath && source.startsWith('/')) {
        image.setAttribute('src', `https://raw.githubusercontent.com/${repoPath}/${branch}/${source.replace(/^\/+/, '')}`);
      }
      image.setAttribute('loading', 'lazy');
      image.setAttribute('decoding', 'async');
    });
    return doc.body.innerHTML;
  };
})();
