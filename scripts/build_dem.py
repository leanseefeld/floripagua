import math, os, json, struct
from PIL import Image
import numpy as np
Z=12; lat0,lat1,lon0,lon1 = -27.95,-27.30,-48.95,-48.35
n=2**Z
def t(lat,lon):
    x=int((lon+180)/360*n); y=int((1-math.log(math.tan(math.radians(lat))+1/math.cos(math.radians(lat)))/math.pi)/2*n); return x,y
x0,y1=t(lat0,lon0); x1,y0=t(lat1,lon1)
W=(x1-x0+1)*256; H=(y1-y0+1)*256
grid=np.zeros((H,W),dtype=np.float32)
for x in range(x0,x1+1):
    for y in range(y0,y1+1):
        im=np.asarray(Image.open(f'data/raw/dem/{Z}_{x}_{y}.png').convert('RGB'),dtype=np.float32)
        h=(im[:,:,0]*256+im[:,:,1]+im[:,:,2]/256)-32768
        grid[(y-y0)*256:(y-y0+1)*256,(x-x0)*256:(x-x0+1)*256]=h
# tile bounds in lat/lon (web mercator)
def tile2ll(x,y):
    lon=x/n*360-180; lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*y/n)))); return lat,lon
latN,lonW=tile2ll(x0,y0); latS,lonE=tile2ll(x1+1,y1+1)
print('grid',W,H,'bounds N',latN,'S',latS,'W',lonW,'E',lonE)
# Resample to a regular lat/lon grid? Keep mercator; store mercator bounds; app maps via mercator.
# Downsample 2x for web (approx 60m)
grid=np.where(grid<-50,0.0,grid)          # nodata/bathymetry -> sea level
grid=np.where(grid<0.3,-2.0,grid)      # uniform sea level
g2=grid.reshape(H//2,2,W//2,2).mean(axis=(1,3))
# light 3x3 smoothing to reduce SRTM speckle (keeps coast: only applied where >1 m)
k=np.pad(g2,1,mode='edge'); sm=(k[:-2,:-2]+k[:-2,1:-1]+k[:-2,2:]+k[1:-1,:-2]+k[1:-1,1:-1]*4+k[1:-1,2:]+k[2:,:-2]+k[2:,1:-1]+k[2:,2:])/12
g2=np.where(g2>1.0,sm,g2)
os.makedirs('public/data',exist_ok=True)
# store as 16-bit unsigned (meters*4 + 100) to keep 0.25m precision
q=np.clip((g2+100)*4,0,65535).astype(np.uint16)
open('public/data/dem.bin','wb').write(q.tobytes())
meta={'width':W//2,'height':H//2,'bounds':{'north':latN,'south':latS,'west':lonW,'east':lonE},'encoding':'uint16 le, meters = v/4 - 100','proj':'web-mercator tile grid z12','source':'AWS Terrain Tiles (terrarium) - SRTM/ALOS composite'}
json.dump(meta,open('public/data/dem.json','w'),indent=1)
print(meta, 'min',g2.min(),'max',g2.max(), 'bytes',q.nbytes)
