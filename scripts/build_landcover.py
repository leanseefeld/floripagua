"""ESA WorldCover 2021 (10 m) -> web texture (mercator rows) + class grid aligned to the outer DEM grid."""
import json, math, os, numpy as np, rasterio
from rasterio.windows import from_bounds
from PIL import Image
URL='https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_S30W051_Map.tif'
sat=json.load(open('public/data/satellite.json'))['bounds']; dem=json.load(open('public/data/dem.json'))
b=sat  # same tile-grid bounds as DEM (z12/z13 share edges)
os.environ['AWS_NO_SIGN_REQUEST']='YES'
with rasterio.open(URL) as src:
    win=from_bounds(b['west'],b['south'],b['east'],b['north'],src.transform)
    arr=src.read(1,window=win); tr=src.window_transform(win)
print('read',arr.shape)
H,W=arr.shape
# source rows are evenly spaced in latitude; output rows evenly spaced in mercator y
def mercY(lat): s=math.sin(math.radians(lat)); return 0.5-math.log((1+s)/(1-s))/(4*math.pi)
lat_top=tr.f; dlat=-tr.e
OW,OH=2048, int(2048*(mercY(b['south'])-mercY(b['north']))/((b['east']-b['west'])/360*1)*(1/ (1/360)) ) if False else None
# compute output height from aspect of mercator extents
mx=(b['east']-b['west'])/360; my=mercY(b['south'])-mercY(b['north']); OH=int(OW*my/mx)
ys=mercY(b['north'])+(np.arange(OH)+0.5)/OH*my
lats=np.degrees(np.arctan(np.sinh(np.pi*(1-2*ys))))
rows=np.clip(((lat_top-lats)/dlat).astype(int),0,H-1)
cols=np.clip((np.arange(OW)+0.5)/OW*W,0,W-1).astype(int)
out=arr[rows][:,cols]
PAL={10:(0,100,0),20:(255,187,34),30:(255,255,76),40:(240,150,255),50:(250,0,0),60:(180,180,180),70:(240,240,240),80:(0,100,200),90:(0,150,160),95:(0,207,117),100:(250,230,160),0:(0,0,0)}
rgb=np.zeros((OH,OW,3),dtype=np.uint8)
for k,v in PAL.items(): rgb[out==k]=v
Image.fromarray(rgb).save('public/data/landcover.png',optimize=True)
json.dump({'bounds':b,'classes':{'10':'Floresta','20':'Arbustos','30':'Campo/gramíneas','40':'Agricultura','50':'Área urbana','60':'Solo exposto','70':'Neve','80':'Água','90':'Áreas úmidas','95':'Mangue','100':'Musgos/líquens'},'palette':{str(k):'#%02x%02x%02x'%v for k,v in PAL.items()},'source':'ESA WorldCover 2021 v200 (10 m), © ESA WorldCover project / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium, CC BY 4.0'},open('public/data/landcover.json','w'),indent=1,ensure_ascii=False)
# class grid aligned to outer DEM grid (896x1152, mercator)
gw,gh=dem['width'],dem['height']
ys2=mercY(b['north'])+(np.arange(gh)+0.5)/gh*my; lats2=np.degrees(np.arctan(np.sinh(np.pi*(1-2*ys2))))
rows2=np.clip(((lat_top-lats2)/dlat).astype(int),0,H-1); cols2=np.clip((np.arange(gw)+0.5)/gw*W,0,W-1).astype(int)
grid=arr[rows2][:,cols2].astype(np.uint8)
open('public/data/landcover.bin','wb').write(grid.tobytes())
u,c=np.unique(grid,return_counts=True); print(dict(zip(u.tolist(),(c/ c.sum()).round(3).tolist())))
print('texture',rgb.shape,os.path.getsize('public/data/landcover.png')//1024,'KB')
