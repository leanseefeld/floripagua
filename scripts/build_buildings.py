import json, struct, math, re
d=json.load(open('data/raw/osm_buildings.json'))
out=bytearray(); n=0; nv=0
def parse_h(t):
    h=t.get('height'); lv=t.get('building:levels')
    try:
        if h: return float(re.sub(r'[^\d.]','',h.replace(',','.')))
    except: pass
    try:
        if lv: return float(lv)*3.2+1.5
    except: pass
    b=t.get('building','yes')
    if b in ('house','residential','detached','hut','shed','garage','bungalow'): return 5.0
    if b in ('apartments','hotel','office','commercial','tower'): return 18.0
    if b in ('industrial','warehouse','retail','supermarket','church','school','hospital','university'): return 8.0
    return 6.0
def kind(t):
    b=t.get('building','yes')
    if b in ('apartments','hotel','office','commercial','tower','retail','supermarket'): return 1
    if b in ('industrial','warehouse'): return 2
    if b in ('school','hospital','university','church','public','civic'): return 3
    return 0
for e in d['elements']:
    g=e.get('geometry')
    if not g or len(g)<4: continue
    t=e.get('tags',{})
    pts=[(p['lon'],p['lat']) for p in g]
    if pts[0]==pts[-1]: pts=pts[:-1]
    # simplify tiny edges (<1.5m)
    simp=[]
    for p in pts:
        if simp:
            dx=(p[0]-simp[-1][0])*math.cos(math.radians(p[1]))*111320; dy=(p[1]-simp[-1][1])*111320
            if dx*dx+dy*dy<1.5*1.5: continue
        simp.append(p)
    if len(simp)<3: continue
    if len(simp)>24: simp=simp[::max(1,len(simp)//24)][:24]
    h=parse_h(t); k=kind(t)
    cx=sum(p[0] for p in simp)/len(simp); cy=sum(p[1] for p in simp)/len(simp)
    out+=struct.pack('<BBHff',len(simp),k,int(min(h,600)*10),cx,cy)
    for lon,lat in simp: out+=struct.pack('<hh',int(round((lon-cx)*1e6)),int(round((lat-cy)*1e6)))  # microdegree offsets (int16 => ±0.032°)
    n+=1; nv+=len(simp)
open('public/data/buildings.bin','wb').write(struct.pack('<I',n)+bytes(out))
json.dump({'count':n,'vertices':nv,'format':'u32 count; per bldg: u8 nverts,u8 kind,u16 height*10,f32 clon,f32 clat, nverts*(i16 dlon_microdeg,i16 dlat_microdeg)','kinds':{0:'residential/other',1:'commercial/apartments',2:'industrial',3:'institutional'},'source':'OpenStreetMap via Overpass, ODbL'},open('public/data/buildings.json','w'),indent=1)
print(n,nv,len(out))
