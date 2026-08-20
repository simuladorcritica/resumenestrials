(() => {
  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const memberPages = new Set(['login.html','registro.html','recuperar.html','cuenta.html','biblioteca.html']);
  if (!memberPages.has(file)) return;
  if (document.getElementById('rt-member-design-v3')) return;
  document.documentElement.dataset.rtMemberDesign = 'v3';
  document.body?.classList.add('rt-member-v3', `rt-member-${file.replace('.html','')}`);
  if (!document.body) document.addEventListener('DOMContentLoaded', () => document.body.classList.add('rt-member-v3', `rt-member-${file.replace('.html','')}`), {once:true});
  const style = document.createElement('style');
  style.id = 'rt-member-design-v3';
  style.textContent = `
    html[data-rt-member-design="v3"] body{background:#f7f6f2!important;color:#12233b!important;text-rendering:optimizeLegibility}
    html[data-rt-member-design="v3"] body::before{content:"";display:block;height:3px;background:linear-gradient(90deg,#0f5f5f 0 72%,#c8892a 72% 100%)}
    html[data-rt-member-design="v3"] .page{max-width:1380px!important;padding-left:clamp(24px,5.5vw,78px)!important;padding-right:clamp(24px,5.5vw,78px)!important}
    html[data-rt-member-design="v3"] .top{min-height:78px!important;border-bottom:1px solid #ddd8cc!important}
    html[data-rt-member-design="v3"] .brand img{height:43px!important;width:auto!important}
    html[data-rt-member-design="v3"] .volver{font-size:9.5px!important;letter-spacing:.14em!important;color:#38506e!important;padding:8px 0;border-bottom:1px solid transparent!important}
    html[data-rt-member-design="v3"] .volver:hover{color:#0f5f5f!important;border-bottom-color:#0f5f5f!important}
    html[data-rt-member-design="v3"] h1,html[data-rt-member-design="v3"] h2{letter-spacing:-.03em!important}
    html[data-rt-member-design="v3"] input[type="text"],html[data-rt-member-design="v3"] input[type="email"],html[data-rt-member-design="v3"] input[type="password"],html[data-rt-member-design="v3"] select{border-radius:0!important;border:0!important;border-bottom:1px solid #bfc3be!important;background:rgba(255,255,255,.48)!important;padding:13px 12px!important;box-shadow:none!important}
    html[data-rt-member-design="v3"] input:focus,html[data-rt-member-design="v3"] select:focus{outline:none!important;border-bottom-color:#1c8a8a!important;box-shadow:0 2px 0 rgba(28,138,138,.13)!important}
    html[data-rt-member-design="v3"] label{font-size:9px!important;letter-spacing:.13em!important;color:#38506e!important}
    html[data-rt-member-design="v3"] .btn,html[data-rt-member-design="v3"] button.primary,html[data-rt-member-design="v3"] button#enviar,html[data-rt-member-design="v3"] button#guardar{border-radius:0!important;box-shadow:none!important;min-height:46px!important;font-size:9.5px!important;letter-spacing:.085em!important}
    html[data-rt-member-design="v3"] .estado{font-size:10px!important;line-height:1.55!important}

    html[data-rt-member-design="v3"] .shell{border-bottom:0!important}
    html[data-rt-member-design="v3"] .story,html[data-rt-member-design="v3"] .value{position:relative;border-right:1px solid #ddd8cc!important;padding-top:72px!important;padding-bottom:72px!important}
    html[data-rt-member-design="v3"] .story::before,html[data-rt-member-design="v3"] .value::before{content:"";position:absolute;top:48px;left:0;width:42px;height:2px;background:#c8892a}
    html[data-rt-member-design="v3"] .story h1,html[data-rt-member-design="v3"] .value h1{font-size:clamp(50px,5.2vw,72px)!important;line-height:.95!important;max-width:10ch!important}
    html[data-rt-member-design="v3"] .story p,html[data-rt-member-design="v3"] .value p{color:#38506e!important}
    html[data-rt-member-design="v3"] .formside{padding-top:76px!important;padding-bottom:72px!important;max-width:720px!important}
    html[data-rt-member-design="v3"] .formside h2{font-size:clamp(42px,4.2vw,54px)!important;line-height:1!important;margin-bottom:12px!important}
    html[data-rt-member-design="v3"] .formside .sub{font-size:18px!important;max-width:40ch!important;margin-bottom:38px!important}
    html[data-rt-member-design="v3"] .campo{margin-bottom:21px!important}
    html[data-rt-member-design="v3"] .check{font-size:15.5px!important}
    html[data-rt-member-design="v3"] .alta,html[data-rt-member-design="v3"] .login{font-size:15px!important;padding-top:22px!important;border-top:1px solid #ddd8cc!important}
    html[data-rt-member-design="v3"] .mail-note{background:transparent!important;border:0!important;border-left:2px solid #c8892a!important;padding:7px 0 7px 18px!important;font-size:15.5px!important}
    html[data-rt-member-design="v3"] .correo{padding:17px 0!important}
    html[data-rt-member-design="v3"] .notice{background:transparent!important}
    html[data-rt-member-design="v3"] .mfa-step{border-top:2px solid #12233b;padding-top:24px!important}

    html[data-rt-member-design="v3"] body.rt-member-cuenta .page,html[data-rt-member-design="v3"] body.rt-member-biblioteca .page{max-width:1380px!important}
    html[data-rt-member-design="v3"] body.rt-member-cuenta .shell{grid-template-columns:220px minmax(0,1fr)!important;gap:64px!important}
    html[data-rt-member-design="v3"] body.rt-member-cuenta .side{border-right:1px solid #ddd8cc!important;padding-right:30px!important}
    html[data-rt-member-design="v3"] body.rt-member-cuenta .avatar{border-radius:0!important;border:0!important;border-bottom:2px solid #c8892a!important;justify-content:flex-start!important;width:44px!important;height:44px!important}
    html[data-rt-member-design="v3"] body.rt-member-cuenta .nav button{font-size:15px!important;padding:12px 0!important}
    html[data-rt-member-design="v3"] body.rt-member-cuenta .content h1{font-size:clamp(44px,5vw,64px)!important;line-height:.98!important;margin-bottom:12px!important}
    html[data-rt-member-design="v3"] body.rt-member-cuenta .card{padding:25px 0!important;border-top:1px solid #ddd8cc!important}
    html[data-rt-member-design="v3"] body.rt-member-cuenta .card h2{font-size:27px!important}
    html[data-rt-member-design="v3"] body.rt-member-cuenta .pill{border-radius:0!important;padding:0 0 3px!important;border-bottom:1px solid currentColor!important}
    html[data-rt-member-design="v3"] body.rt-member-cuenta .qr-box{background:transparent!important}

    html[data-rt-member-design="v3"] body.rt-member-biblioteca .topbar{background:rgba(247,246,242,.95)!important;border-bottom:1px solid #ddd8cc!important}
    html[data-rt-member-design="v3"] body.rt-member-biblioteca .page{padding-top:64px!important}
    html[data-rt-member-design="v3"] body.rt-member-biblioteca h1{font-size:clamp(54px,7vw,82px)!important;line-height:.9!important;max-width:9ch!important}
    html[data-rt-member-design="v3"] body.rt-member-biblioteca .lead{font-size:20px!important;max-width:52ch!important}
    html[data-rt-member-design="v3"] body.rt-member-biblioteca .tools{margin-top:48px!important;border-top:2px solid #12233b!important;padding-top:16px!important}
    html[data-rt-member-design="v3"] body.rt-member-biblioteca .tools input,html[data-rt-member-design="v3"] body.rt-member-biblioteca .tools select{font-family:'IBM Plex Mono',monospace!important;font-size:10px!important}
    html[data-rt-member-design="v3"] body.rt-member-biblioteca .item{padding:29px 0!important}
    html[data-rt-member-design="v3"] body.rt-member-biblioteca .item h2{font-size:30px!important;line-height:1.08!important}
    html[data-rt-member-design="v3"] body.rt-member-biblioteca .badge{border-radius:0!important;border:0!important;border-bottom:1px solid rgba(15,95,95,.32)!important;padding:0 0 3px!important;background:transparent!important;font-size:9px!important}

    @media(max-width:900px){
      html[data-rt-member-design="v3"] .story,html[data-rt-member-design="v3"] .value{border-right:0!important;border-bottom:1px solid #ddd8cc!important;padding-top:54px!important;padding-bottom:42px!important}
      html[data-rt-member-design="v3"] .story::before,html[data-rt-member-design="v3"] .value::before{top:34px}
      html[data-rt-member-design="v3"] .formside{padding-top:48px!important;padding-bottom:54px!important}
      html[data-rt-member-design="v3"] body.rt-member-cuenta .shell{grid-template-columns:1fr!important;gap:34px!important}
      html[data-rt-member-design="v3"] body.rt-member-cuenta .side{border-right:0!important;border-bottom:1px solid #ddd8cc!important;padding-right:0!important}
    }
    @media(max-width:620px){
      html[data-rt-member-design="v3"] body::before{height:2px}
      html[data-rt-member-design="v3"] .page{padding-left:18px!important;padding-right:18px!important}
      html[data-rt-member-design="v3"] .brand img{height:37px!important}
      html[data-rt-member-design="v3"] .story h1,html[data-rt-member-design="v3"] .value h1{font-size:46px!important}
      html[data-rt-member-design="v3"] .formside h2{font-size:39px!important}
      html[data-rt-member-design="v3"] body.rt-member-biblioteca h1{font-size:56px!important}
    }
  `;
  document.head.appendChild(style);
})();
