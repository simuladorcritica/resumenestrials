#!/usr/bin/env python3
"""Validate actual PDF words and paragraph geometry using Poppler's bounding boxes.

Usage: python scripts/verify-pdf-justification.py --before DIR --after DIR
       --pdftotext PATH --report OUT.json
Requires pdftotext and pypdf; artifacts stay outside the public checkout.
"""
from pathlib import Path
from html import unescape
from html.parser import HTMLParser
import argparse, json, re, subprocess, unicodedata, xml.etree.ElementTree as ET
from pypdf import PdfReader

def sanitize(s):
 s=unicodedata.normalize('NFKC',s)
 for a,b in {'−':'-','–':'-','—':'-','―':'-','‒':'-','‑':'-','‘':"'",'’':"'",'‛':"'",'′':"'",'“':'"','”':'"','‟':'"','″':'"','…':'...','≥':'>=','≤':'<=','≠':'!=','≈':'~','≅':'~','→':'->','←':'<-','α':'alpha','β':'beta','γ':'gamma','δ':'delta','μ':'u','Δ':'Delta','χ':'chi','σ':'sigma'}.items():s=s.replace(a,b)
 for i in range(10):s=s.replace(chr(0x2080+i),str(i))
 return re.sub('[\u00a0\u2007\u2009\u200a\u202f]',' ',s).replace('\u200b','')

class Paragraphs(HTMLParser):
 def __init__(self):super().__init__();self.paragraphs=[];self.buffer=None
 def handle_starttag(self,tag,attrs):
  if tag=='p':self.buffer=[]
 def handle_data(self,data):
  if self.buffer is not None:self.buffer.append(data)
 def handle_endtag(self,tag):
  if tag=='p' and self.buffer is not None:self.paragraphs.append(sanitize(''.join(self.buffer)).split());self.buffer=None

def extract(exe,path,bbox=False):
 args=[str(exe),'-enc','UTF-8',*(['-bbox-layout'] if bbox else ['-layout','-nopgbrk']),str(path),'-']
 return subprocess.run(args,check=True,capture_output=True).stdout.decode('utf8')

def verify(args):
 records={int(r['id']):r for r in json.loads(Path('resumenes.json').read_text(encoding='utf8'))}
 before=Path(args.before);after=Path(args.after);files=sorted(before.glob('*.pdf'));assert len(files)==672
 errors=[];results=[]
 for source in files:
  target=after/source.name;failure=[];m=re.fullmatch(r'Resumen_(\d+)_(completo|breve)_(a4|mobile)\.pdf',source.name);assert m,source.name
  trial_id=int(m[1]);record=records[trial_id];mobile=m[3]=='mobile';margin=26 if mobile else 48
  original=extract(args.pdftotext,source).split();updated=extract(args.pdftotext,target).split()
  if original!=updated:failure.append('Word sequence changed')
  reader=PdfReader(target);pages=list(reader.pages)
  if 'Resumen '+str(trial_id) not in (reader.metadata.subject or ''):failure.append('Wrong ID')
  full=' '.join((p.extract_text() or '') for p in pages)
  if sanitize(record['titulo']) not in re.sub(r'\s+',' ',full):failure.append('Missing title')
  if '\ufffd' in full:failure.append('Broken replacement character')
  for heading in re.findall(r'<h2\b[^>]*>([\s\S]*?)</h2>',record['corto' if m[2]=='breve' else 'cuerpo'],re.I):
   expected=sanitize(unescape(re.sub('<[^>]+>','',heading)))
   if expected not in re.sub(r'\s+',' ',full):failure.append('Missing section '+expected)
  for page in pages:
   operators=page.get_contents().operations;images=sum(op==b'Do' for _,op in operators)
   states=page['/Resources'].get('/ExtGState',{});watermark=any(float(v.get_object().get('/ca',1))<.1 for v in states.values())
   if images<2 or not watermark:failure.append('Missing logo/watermark')
  def bounding_lines(path):
   xml=ET.fromstring(extract(args.pdftotext,path,True));lines=[]
   for page_number,page in enumerate(xml.findall('.//{*}page'),1):
    height=float(page.attrib['height']);width=float(page.attrib['width'])
    rows={}
    # A fully stretched line can be split into apparent columns by Poppler's
    # reading-order heuristic. Validate its actual physical rows and coordinates.
    for word in page.findall('.//{*}word'):
     top=float(word.attrib['yMin'])
     if top<64 or top>height-62:continue
     rows.setdefault(round(top,2),[]).append({'text':word.text or '',**{k:float(v) for k,v in word.attrib.items()}})
    for top,words in sorted(rows.items()):lines.append({'page':page_number,'right':width-margin,'words':sorted(words,key=lambda w:w['xMin'])})
   return lines
  lines=bounding_lines(target);original_lines=bounding_lines(source);original_stream=[(w['text'],i,j) for i,line in enumerate(original_lines) for j,w in enumerate(line['words'])];original_tokens=[w[0] for w in original_stream];original_cursor=0
  stream=[(w['text'],i,j) for i,line in enumerate(lines) for j,w in enumerate(line['words'])]
  tokens=[w[0] for w in stream];paragraphs=Paragraphs();paragraphs.feed(record['corto' if m[2]=='breve' else 'cuerpo']);cursor=0;checked=0;exceptions=0
  for paragraph in paragraphs.paragraphs:
   start=next((i for i in range(cursor,len(tokens)-len(paragraph)+1) if tokens[i:i+len(paragraph)]==paragraph),None)
   if start is None:failure.append('Paragraph not extractable: '+' '.join(paragraph[:5]));continue
   finish=start+len(paragraph)-1;first_line=stream[start][1];last_line=stream[finish][1];cursor=finish+1
   original_start=next((i for i in range(original_cursor,len(original_tokens)-len(paragraph)+1) if original_tokens[i:i+len(paragraph)]==paragraph),None)
   if original_start is None:failure.append('Baseline paragraph missing');continue
   original_finish=original_start+len(paragraph)-1;original_cursor=original_finish+1;old_line=original_lines[original_stream[original_finish][1]];old_end=old_line['words'][original_stream[original_finish][2]]['xMax']
   for i in range(first_line,last_line+1):
    line=lines[i];words=line['words'];end=words[-1]['xMax'];gaps=[b['xMin']-a['xMax'] for a,b in zip(words,words[1:])];height=sum(w['yMax']-w['yMin'] for w in words)/len(words)
    # Poppler Times boxes are ~0.9 em; Helvetica boxes ~0.925 em.
    # Small text after a page stamp retains the pre-change font contract.
    natural_space=height*(.278/.925 if height<8 else .25/.9)
    if i==last_line:
     if abs(words[0]['xMin']-margin)>.5:failure.append('Final line not at start')
     if abs(end-old_end)>1:failure.append('Final line width changed from left-aligned baseline')
    elif len(words)>1:
     if abs(end-line['right'])<=1:checked+=1
     elif mobile:exceptions+=1
     else:failure.append('A4 paragraph line not justified')
     if mobile and gaps and max(gaps)>natural_space*2.5+1:failure.append('Mobile word gap above 2.5x natural space')
  result={'file':source.name,'pages':len(pages),'paragraphs':len(paragraphs.paragraphs),'justifiedLines':checked,'mobileSparseLines':exceptions,'errors':failure};results.append(result)
  if failure:errors.append(result)
  if len(results)%48==0:print('PDF geometry/text',len(results),'errors',len(errors),flush=True)
 report={'documents':len(results),'wordComparison':'pdftotext -layout whitespace-normalized tokens','errors':errors,'results':results};Path(args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');assert not errors,str(errors[:3])

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--before',required=True);parser.add_argument('--after',required=True);parser.add_argument('--pdftotext',default='pdftotext');parser.add_argument('--report',required=True);verify(parser.parse_args())
