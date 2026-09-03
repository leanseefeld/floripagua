"""Generic XYZ tile fetcher. usage: python3 fetch_tiles.py <name> <z> <lat0> <lat1> <lon0> <lon1> <url-template with {z}/{x}/{y}>"""
import math, os, sys, urllib.request, time, concurrent.futures
name, Z, lat0, lat1, lon0, lon1, url = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5]), float(sys.argv[6]), sys.argv[7]
n = 2 ** Z
def t(lat, lon):
    x = int((lon + 180) / 360 * n); y = int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n); return x, y
x0, y1 = t(lat0, lon0); x1, y0 = t(lat1, lon1)
d = f'data/raw/tiles/{name}/{Z}'; os.makedirs(d, exist_ok=True)
jobs = [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
print(name, 'tiles', len(jobs), 'x', x0, x1, 'y', y0, y1)
def get(xy):
    x, y = xy; p = f'{d}/{x}_{y}.bin'
    if os.path.exists(p) and os.path.getsize(p) > 0: return 0
    u = url.format(z=Z, x=x, y=y)
    for i in range(3):
        try:
            req = urllib.request.Request(u, headers={'User-Agent': 'floripa-water-viz/0.1 research'})
            data = urllib.request.urlopen(req, timeout=30).read(); open(p, 'wb').write(data); return 1
        except Exception as e:
            time.sleep(1 + i)
    print('FAILED', u); return -1
with concurrent.futures.ThreadPoolExecutor(8) as ex: res = list(ex.map(get, jobs))
print('downloaded', sum(1 for r in res if r == 1), 'failed', sum(1 for r in res if r == -1))
print('meta', x0, x1, y0, y1)
