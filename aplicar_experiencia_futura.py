"""Compatibility entry point for the documented generator sequence."""
from pathlib import Path
from site_templates import ROOT, EXCLUDED, ADSENSE_CLIENT, ADSENSE_URL, ADSENSE_SCRIPT, render_all
ADSENSE_EXCLUDED_ROUTES=EXCLUDED
ADSENSE_DEFERRED_ROUTES=frozenset({"/resumen.html"})
def adsense_allowed(path):
 route="/"+path.resolve().relative_to(ROOT.resolve()).as_posix()
 return route not in EXCLUDED|ADSENSE_DEFERRED_ROUTES and not route.startswith("/resumen/")
def candidates():
 paths=[ROOT/"_includes/index-source.html",ROOT/"resumen.html",ROOT/"login.html",ROOT/"registro.html",ROOT/"recuperar.html",ROOT/"cuenta.html",ROOT/"biblioteca.html",ROOT/"privacidad.html",ROOT/"privacidad/index.html",ROOT/"terminos/index.html",ROOT/"agregar.html",ROOT/"metodologia/index.html",ROOT/"equipo-editorial/index.html",ROOT/"404.html"]
 paths.extend(sorted((ROOT/"trials").glob("*/index.html")));paths.extend(sorted((ROOT/"medicina-critica").glob("**/index.html")));paths.extend(sorted((ROOT/"medicina-interna").glob("**/index.html")))
 paths.append(ROOT/"index.html");paths.extend(sorted((ROOT/"resumen").glob("*.html")))
 return list(dict.fromkeys(paths))
def inject(path):
 # All presentation comes from templates. This API remains for policy regressions.
 if not path.is_file():return False
 from site_templates import clean_head,version
 import re
 old=path.read_text(encoding="utf-8");new=re.sub(r"/site-runtime\.(css|js)\?v=[^\"']+",lambda m:"/site-runtime."+m[1]+"?v="+version(),old)
 if not adsense_allowed(path):new=re.sub(r"<script\b[^>]*src=[\"']https://pagead2\.googlesyndication\.com/[^\"']+[\"'][^>]*>[\s\S]*?</script>","",new,flags=re.I)
 elif ADSENSE_URL not in new:new=new.replace("</head>",ADSENSE_SCRIPT+"</head>",1)
 if new!=old:path.write_text(new,encoding="utf-8");return True
 return False
def main():
 render_all()
 for path in candidates():inject(path)
if __name__=="__main__":main()
