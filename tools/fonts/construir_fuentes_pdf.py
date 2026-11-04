"""Genera los subconjuntos estáticos (TTF) para el PDF (jsPDF) y las tarjetas sociales (Pillow).
Uso: python3 tools/fonts/construir_fuentes_pdf.py <carpeta-origen> <carpeta-salida>"""
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset
import os
# Fuentes de origen: Google Fonts (OFL) — Newsreader[opsz,wght], Literata[opsz,wght], IBMPlexSans[wdth,wght], IBMPlexSansCondensed.
# IBM Plex tiene el nombre reservado «Plex»: los subconjuntos se renombran (RTSans) como exige la OFL.
import sys
SRC=sys.argv[1] if len(sys.argv)>1 else './fuentes-origen/'
OUT=sys.argv[2] if len(sys.argv)>2 else './salida/'; os.makedirs(OUT,exist_ok=True)
U=list(range(0x20,0x7F))+list(range(0xA0,0x180))+list(range(0x2010,0x2028))+[0x2030,0x2032,0x2033,0x2039,0x203A,0x2044,0x20AC,0x2122,0x2190,0x2191,0x2192,0x2193,0x2212,0x2215,0x2219,0x221E,0x2248,0x2260,0x2264,0x2265]+list(range(0x2070,0x20A0))+list(range(0x2160,0x216A))+list(range(0x391,0x3AA))+list(range(0x3B1,0x3CA))
jobs=[('Newsreader-VF.ttf',{'wght':500,'opsz':24},'Newsreader-Medium-pdf'),
      ('Newsreader-VF.ttf',{'wght':640,'opsz':24},'Newsreader-SemiBold-pdf'),
      ('Newsreader-VF.ttf',{'wght':460,'opsz':72},'Newsreader-Display'),
      ('Newsreader-VF.ttf',{'wght':640,'opsz':72},'Newsreader-DisplayBold'),
      ('Literata-VF.ttf',{'wght':400,'opsz':12},'Literata-Regular'),
      ('Literata-VF.ttf',{'wght':620,'opsz':12},'Literata-SemiBold'),
      ('Literata-Italic-VF.ttf',{'wght':400,'opsz':12},'Literata-Italic'),
      ('IBMPlexSans-VF.ttf',{'wght':400,'wdth':100},'IBMPlexSans-Regular','RTSans-Regular'),
      ('IBMPlexSans-VF.ttf',{'wght':500,'wdth':100},'IBMPlexSans-Medium','RTSans-Medium'),
      ('IBMPlexSansCondensed-SemiBold.ttf',None,'IBMPlexSansCondensed-SemiBold','RTSansCondensed-SemiBold')]
for job in jobs:
    src,axes,name=job[:3]; internal=job[3] if len(job)>3 else name
    f=TTFont(SRC+src)
    if axes:
        f=instancer.instantiateVariableFont(f,axes,updateFontNames=False)
    opts=subset.Options(); opts.layout_features=['kern']; opts.name_IDs=['*']; opts.notdef_outline=True; opts.drop_tables+=['STAT','DSIG']
    cm=f.getBestCmap(); keep=[u for u in U if u in cm]
    s=subset.Subsetter(opts); s.populate(unicodes=keep); s.subset(f)
    # rename family so jsPDF/Pillow see distinct names
    for rec in f['name'].names:
        if rec.nameID in (1,4,6,16): rec.string = internal
    f.save(OUT+name+'.ttf')
    print(name, os.path.getsize(OUT+name+'.ttf'), 'missing:', ''.join(chr(u) for u in U if u not in cm and (u<0x370 or u>0x3FF))[:40], 'greek', sum(1 for u in U if 0x370<u<0x400 and u in cm))
