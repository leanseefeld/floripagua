import re, json, sys
# Parse PEC text tables: find entity name lines near Latitude/Longitude pairs.
files = {
 'sia': ('data/raw/pec_sia_grande_fpolis.txt','SIA Grande Florianópolis PEC (CASAN 00084155/2023)'),
 'norte': ('data/raw/pec_costa_norte.txt','SAA Costa Norte PEC (CASAN 00032085/2024)'),
 'sul': ('data/raw/pec_costa_sul_leste.txt','SAA Costa Sul/Leste PEC (CASAN 00032085/2024)'),
}
dms = re.compile(r"(\d{1,3})\s*[º°]\s*(\d{1,2})\s*[’'′]\s*([\d.,]+)\s*[\"”″]?\s*([SON])?", re.I)
def todeg(m):
    d,mi,s=int(m.group(1)),int(m.group(2)),float(m.group(3).replace(',','.'))
    return d+mi/60+s/3600
out=[]
for key,(path,src) in files.items():
    lines=open(path,encoding='utf-8').read().split('\n')
    # Keep only description section (before "IDENTIFICAÇÃO DOS RESPONSÁVEIS")
    ends=[i for i,l in enumerate(lines) if 'IDENTIFICAÇÃO DOS RESPONSÁVEIS' in l and i>100]; end=ends[0] if ends else len(lines)
    lines=lines[:end]
    i=0
    while i<len(lines):
        l=lines[i]
        if 'Latitude' in l or 'latitude' in l:
            # find longitude within next 3 lines (or same line)
            block=' '.join(lines[i:i+4])
            lat=None;lon=None
            for m in dms.finditer(block):
                v=todeg(m)
                # heuristic: lat ~27.x, lon ~48.x (some entries are swapped)
                if 27<=v<28.5 and lat is None: lat=-v
                elif 48<=v<49.5 and lon is None: lon=-v
            if lat is None or lon is None: i+=1; continue
            # find name: search up to 4 lines above/below for a line starting with known keyword
            name=None;cap=None
            ctx=lines[max(0,i-4):i+5]
            for c in ctx:
                m=re.match(r"^\s*((?:ERAT|ERAB|Booster|Reservat[óo]rio|Poço|Erat|Tanque|Daniela Tanque|R\d+\s*[–-]|Pulmão|Barreiros|São Luiz|Colônia Santana|Loteamento Santa|Res\. rua|Localizado|ETA|Captação)[^\n]*)", c)
                if m and name is None:
                    name=m.group(1).strip()
                m2=re.search(r"(\d[\d\.]*)\s*m³",c)
                if m2 and cap is None: cap=float(m2.group(1).replace('.',''))
            # municipality prefix
            muni=None
            for c in ctx:
                mm=re.match(r"^\s*(Florianópolis|São José|Biguaçu|Santo Amaro)",c)
                if mm: muni=mm.group(1)
            out.append({'src':key,'name':name or '?', 'lat':round(lat,6),'lon':round(lon,6),'cap_m3':cap,'muni':muni,'line':i+1})
        i+=1
json.dump(out,open('data/raw/pec_entities_raw.json','w'),ensure_ascii=False,indent=1)
print(len(out))
for o in out: print(o['src'],o['line'],o['lat'],o['lon'],o['cap_m3'],o['muni'],'|',o['name'])
