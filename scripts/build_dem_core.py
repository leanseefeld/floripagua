import math, json, os
import numpy as np
from PIL import Image
Z=14; x0,x1,y0,y1 = 5969,5991,9488,9507
d=f'data/raw/tiles/dem14/{Z}'; n=2**Z
W=(x1-x0+1)*256; H=(y1-y0+1)*256
g=np.zeros((H,W),dtype=np.float32)
for x in range(x0,x1+1):
    for y in range(y0,y1+1):
        im=np.asarray(Image.open(f'{d}/{x}_{y}.bin').convert('RGB'),dtype=np.float32)
        g[(y-y0)*256:(y-y0+1)*256,(x-x0)*256:(x-x0+1)*256]=(im[:,:,0]*256+im[:,:,1]+im[:,:,2]/256)-32768
def tile2ll(x,y):
    lon=x/n*360-180; lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*y/n)))); return lat,lon
latN,lonW=tile2ll(x0,y0); latS,lonE=tile2ll(x1+1,y1+1)
g=np.where(g<0.3,-2.0,g)
F=4
g2=g.reshape(H//F,F,W//F,F).mean(axis=(1,3))
# gentle 3x3 smoothing on land only
k=np.pad(g2,1,mode='edge'); sm=(k[:-2,:-2]+k[:-2,1:-1]+k[:-2,2:]+k[1:-1,:-2]+k[1:-1,1:-1]*4+k[1:-1,2:]+k[2:,:-2]+k[2:,1:-1]+k[2:,2:])/12
g2=np.where(g2>1.0,sm,g2)
q=np.clip((g2+100)*4,0,65535).astype(np.uint16)
open('public/data/dem_core.bin','wb').write(q.tobytes())
meta={'width':W//F,'height':H//F,'bounds':{'north':latN,'south':latS,'west':lonW,'east':lonE},'encoding':'uint16 le, meters = v/4 - 100','proj':'web-mercator tile grid z14 /4 (~34 m)','source':'AWS Terrain Tiles z14 (terrarium; SRTM/ALOS composite)'}
json.dump(meta,open('public/data/dem_core.json','w'),indent=1)
print(meta,'bytes',q.nbytes,'max',g2.max())
