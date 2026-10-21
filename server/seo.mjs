const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function normalizeSiteUrl(value='') {
  if(!value.trim())return '';
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('SITE_URL must be an http(s) origin without a path, credentials, query, or fragment');
  return url.origin+'/';
}

export function pageHtml(template,url,siteUrl) {
  const privatePage=url.pathname==='/play'||url.searchParams.has('room');
  const robots=privatePage?'noindex,follow':'index,follow';
  let tags='';
  if(siteUrl){
    const image=escape(new URL('assets/social-preview.png',siteUrl).href);
    tags=`<meta name="site-url" content="${escape(siteUrl)}">\n  <meta property="og:image" content="${image}">\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">\n  <meta property="og:image:alt" content="Halloween Bingo 午夜糖果派对：经典数字与万圣图案双模式">\n  <meta name="twitter:image" content="${image}">\n  <meta name="twitter:image:alt" content="Halloween Bingo 午夜糖果派对：经典数字与万圣图案双模式">`;
    // Share the public landing page without exposing temporary room codes.
    tags+=`\n  <meta property="og:url" content="${escape(siteUrl)}">`;
    if(!privatePage)tags+=`\n  <link rel="canonical" href="${escape(siteUrl)}">`;
  }
  let html=template.replace('<!-- SITE_META -->',tags).replace('name="robots" content="index,follow"',`name="robots" content="${robots}"`);
  if(privatePage)html=html.replace('<body>','<body data-private="true">');
  return {html,robots};
}

export function robotsTxt(siteUrl) {
  return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /.data/\n${siteUrl?`\nSitemap: ${new URL('sitemap.xml',siteUrl).href}\n`:''}`;
}

export function sitemapXml(siteUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(siteUrl)}</loc></url></urlset>\n`;
}
