from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset
import os
SRC='/home/claude/mock/fonts/'; OUT='/home/claude/resumenestrials/fonts/'
LATIN=list(range(0x20,0x7F))+list(range(0xA0,0x100))+[0x131,0x152,0x153,0x2BB,0x2BC,0x2C6,0x2DA,0x2DC,0x304,0x308,0x329]+list(range(0x2000,0x2070))+[0x20AC,0x2122,0x2191,0x2193,0x2212,0x2215,0xFEFF,0xFFFD]
EXT=list(range(0x100,0x250))+list(range(0x2070,0x20A0))+[0x2190,0x2192,0x2248,0x2260,0x2264,0x2265,0x221E]+list(range(0x391,0x3CA))
def build(src,axes,name,uni,out):
    f=TTFont(SRC+src,lazy=False)
    if axes:
        f=instancer.instantiateVariableFont(f,axes,updateFontNames=False)
        import io;b=io.BytesIO();f.save(b);b.seek(0);f=TTFont(b,lazy=False)
    o=subset.Options();o.flavor='woff2';o.layout_features=['kern','liga','lnum','tnum','pnum','onum','smcp','c2sc'];o.name_IDs=['*'];o.drop_tables+=['STAT','DSIG']
    cm=f.getBestCmap();s=subset.Subsetter(o);s.populate(unicodes=[u for u in uni if u in cm]);s.subset(f)
    if name:
        for r in f['name'].names:
            if r.nameID in (1,4,6,16): r.string=name
    f.flavor='woff2';f.save(OUT+out);print(out,os.path.getsize(OUT+out))
for part,uni in (('latin',LATIN),('latin-ext',EXT)):
    build('Newsreader-VF.ttf',{'wght':(400,700),'opsz':30},None,uni,f'newsreader-normal-{part}.woff2')
    build('IBMPlexSans-VF.ttf',{'wght':400,'wdth':100},'RTSans',uni,f'rtsans-400-{part}.woff2')
    build('IBMPlexSans-VF.ttf',{'wght':600,'wdth':100},'RTSans',uni,f'rtsans-600-{part}.woff2')
build('IBMPlexSansCondensed-SemiBold.ttf',None,'RTSansCondensed',LATIN+EXT,'rtsans-condensed-600.woff2')
