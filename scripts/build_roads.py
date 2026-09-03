import json, struct, math
d=json.load(open('data/raw/osm_roads.json'))
cls={'motorway':0,'trunk':1,'primary':2,'secondary':3,'tertiary':4,'motorway_link':5,'trunk_link':5,'primary_link':5}
out=bytearray(); n=0; npts=0
names=[]
for e in d['elements']:
    g=e.get('geometry')
    if not g or len(g)<2: continue
    t=e.get('tags',{})
    c=cls.get(t.get('highway'),4)
    # simplify: drop points closer than ~15m
    pts=[]
    for p in g:
        if pts:
            dx=(p['lon']-pts[-1][0])*math.cos(math.radians(p['lat']))*111320; dy=(p['lat']-pts[-1][1])*111320
            if dx*dx+dy*dy<15*15 and p is not g[-1]: continue
        pts.append((p['lon'],p['lat']))
    if len(pts)<2: continue
    out+=struct.pack('<IB',len(pts),c)
    for lon,lat in pts: out+=struct.pack('<ff',lon,lat)
    names.append(t.get('name') or t.get('ref') or '')
    n+=1; npts+=len(pts)
open('public/data/roads.bin','wb').write(struct.pack('<I',n)+bytes(out))
json.dump({'count':n,'points':npts,'classes':cls,'format':'u32 count; per way: u32 npts,u8 class, npts*(f32 lon,f32 lat)','source':'OpenStreetMap via Overpass, ODbL'},open('public/data/roads.json','w'),indent=1)
print(n,npts,len(out))
