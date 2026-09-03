"""Occupied-land mask (10 m source → ~30 m mercator grid, bit-packed) for distribution-zone footprints.
occupied = WorldCover built-up ∪ OSM landuse (residential/commercial/industrial/retail) ∪ OSM buildings (dilated 20 m),
           closed morphologically (fills gaps between houses), minus WorldCover water and minus sea (DEM ≤ 0.3 m)."""
import json, math, os, numpy as np, rasterio
from rasterio.windows import from_bounds
from PIL import Image, ImageDraw
from scipy import ndimage
URL='https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_S30W051_Map.tif'
b=json.load(open('public/data/satellite.json'))['bounds']
os.environ['AWS_NO_SIGN_REQUEST']='YES'
with rasterio.open(URL) as src:
    win=from_bounds(b['west'],b['south'],b['east'],b['north'],src.transform); lc=src.read(1,window=win); tr=src.window_transform(win)
H,W=lc.shape; lat_top=tr.f; dlat=-tr.e; lon_left=tr.c; dlon=tr.a
print('worldcover window',lc.shape)
def px(lon,lat): return ((lon-lon_left)/dlon, (lat_top-lat)/dlat)
# --- OSM landuse polygons ---
lu=Image.new('L',(W,H),0); dr=ImageDraw.Draw(lu)
d=json.load(open('data/raw/osm_landuse.json')); npoly=0
for e in d['elements']:
    if e['type']=='way' and e.get('geometry'):
        pts=[px(p['lon'],p['lat']) for p in e['geometry']]
        if len(pts)>=3: dr.polygon(pts,fill=1); npoly+=1
    elif e['type']=='relation':
        for m in e.get('members',[]):
            if m.get('role')=='outer' and m.get('geometry'):
                pts=[px(p['lon'],p['lat']) for p in m['geometry']]
                if len(pts)>=3: dr.polygon(pts,fill=1); npoly+=1
        for m in e.get('members',[]):
            if m.get('role')=='inner' and m.get('geometry'):
                pts=[px(p['lon'],p['lat']) for p in m['geometry']]
                if len(pts)>=3: dr.polygon(pts,fill=0)
lu=np.asarray(lu,dtype=bool); print('landuse polygons',npoly,'cover',lu.mean().round(4))
# --- OSM buildings (footprints) ---
bl=Image.new('L',(W,H),0); db=ImageDraw.Draw(bl)
bd=json.load(open('data/raw/osm_buildings.json')); nb=0
for e in bd['elements']:
    g=e.get('geometry')
    if g and len(g)>=3: db.polygon([px(p['lon'],p['lat']) for p in g],fill=1); nb+=1
bl=np.asarray(bl,dtype=bool); bl=ndimage.binary_dilation(bl,iterations=2)  # +20 m
print('buildings',nb)
occ=(lc==50)|lu|bl
occ=ndimage.binary_closing(occ,structure=np.ones((3,3)),iterations=3)      # fill gaps ≤ ~60 m
occ=ndimage.binary_opening(occ,structure=np.ones((3,3)),iterations=1)      # drop specks
occ&=(lc!=80)
# --- sea/lake mask from the DEM (outer 70 m grid, mercator) ---
dem=json.load(open('public/data/dem.json')); g=np.frombuffer(open('public/data/dem.bin','rb').read(),dtype=np.uint16).reshape(dem['height'],dem['width']).astype(np.float32)/4-100
def mercY(lat): s=math.sin(math.radians(lat)); return 0.5-math.log((1+s)/(1-s))/(4*math.pi)
db_=dem['bounds']; y0=mercY(db_['north']); y1=mercY(db_['south'])
lats=lat_top-(np.arange(H)+0.5)*dlat; lons=lon_left+(np.arange(W)+0.5)*dlon
gy=np.clip(((np.vectorize(mercY)(lats)-y0)/(y1-y0)*dem['height']).astype(int),0,dem['height']-1)
gx=np.clip(((lons-db_['west'])/(db_['east']-db_['west'])*dem['width']).astype(int),0,dem['width']-1)
sea=(g[gy][:,gx]<=0.3)
sea=ndimage.binary_erosion(sea,iterations=2)   # keep the shoreline strip (70 m DEM is coarse)
occ&=~sea
print('occupied fraction',occ.mean().round(4))
# --- resample to the mercator grid of landcover.png (≈30 m) and bit-pack ---
OW=2048; mx=(b['east']-b['west'])/360; my=mercY(b['south'])-mercY(b['north']); OH=int(OW*my/mx)
ys=mercY(b['north'])+(np.arange(OH)+0.5)/OH*my; olats=np.degrees(np.arctan(np.sinh(np.pi*(1-2*ys))))
rows=np.clip(((lat_top-olats)/dlat).astype(int),0,H-1); cols=np.clip((np.arange(OW)+0.5)/OW*W,0,W-1).astype(int)
out=occ[rows][:,cols]
packed=np.packbits(out,axis=1)
open('public/data/occupied.bin','wb').write(packed.tobytes())
json.dump({'width':OW,'height':OH,'bounds':b,'proj':'web-mercator rows (same grid as landcover.png)','encoding':'1 bit per cell, rows packed big-endian (numpy packbits axis=1), row stride = ceil(width/8) bytes','definition':'WorldCover built-up ∪ OSM landuse ∪ OSM buildings(+20 m), closing 3x3×3, opening, minus water, minus sea','source':'ESA WorldCover 2021; OpenStreetMap (ODbL); AWS Terrain Tiles'},open('public/data/occupied.json','w'),indent=1)
print('grid',OW,OH,'bytes',packed.nbytes,'occupied cells',int(out.sum()))
Image.fromarray((out*255).astype(np.uint8)).save('data/processed/occupied_preview.png')
