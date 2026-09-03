import math, json, os
from PIL import Image
Z=13; x0,x1,y0,y1 = 2982,2995,4742,4758
d=f'data/raw/tiles/sat/{Z}'
W=(x1-x0+1)*256; H=(y1-y0+1)*256
im=Image.new('RGB',(W,H))
for x in range(x0,x1+1):
    for y in range(y0,y1+1):
        try: t=Image.open(f'{d}/{x}_{y}.bin').convert('RGB')
        except Exception as e: print('bad',x,y,e); continue
        im.paste(t,((x-x0)*256,(y-y0)*256))
n=2**Z
def tile2ll(x,y):
    lon=x/n*360-180; lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*y/n)))); return lat,lon
latN,lonW=tile2ll(x0,y0); latS,lonE=tile2ll(x1+1,y1+1)
# desktop texture ≤4096 on the long side, mobile ≤2048
os.makedirs('public/data',exist_ok=True)
for name,maxs,q in (('satellite',4096,82),('satellite_lo',2048,78)):
    s=min(1.0,maxs/max(W,H)); im2=im.resize((int(W*s),int(H*s)),Image.LANCZOS)
    im2.save(f'public/data/{name}.jpg',quality=q,optimize=True,progressive=True)
    print(name,im2.size,os.path.getsize(f'public/data/{name}.jpg')//1024,'KB')
json.dump({'bounds':{'north':latN,'south':latS,'west':lonW,'east':lonE},'proj':'web-mercator tile grid z13','source':'Esri World Imagery (Esri, Maxar, Earthstar Geographics, and the GIS User Community)'},open('public/data/satellite.json','w'),indent=1)
print('bounds',latN,latS,lonW,lonE)
