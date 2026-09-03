import math, os, sys, urllib.request, time
# AWS Terrain Tiles (terrarium PNG), zoom 12
Z=12
lat0,lat1,lon0,lon1 = -27.95,-27.30,-48.95,-48.35
def t(lat,lon):
    n=2**Z; x=int((lon+180)/360*n); y=int((1-math.log(math.tan(math.radians(lat))+1/math.cos(math.radians(lat)))/math.pi)/2*n); return x,y
x0,y1=t(lat0,lon0); x1,y0=t(lat1,lon1)
os.makedirs('data/raw/dem',exist_ok=True)
print('tiles x',x0,x1,'y',y0,y1,(x1-x0+1)*(y1-y0+1))
for x in range(x0,x1+1):
    for y in range(y0,y1+1):
        p=f'data/raw/dem/{Z}_{x}_{y}.png'
        if os.path.exists(p) and os.path.getsize(p)>0: continue
        u=f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png'
        for i in range(3):
            try: urllib.request.urlretrieve(u,p); break
            except Exception as e: print('retry',u,e); time.sleep(2)
print('done')
