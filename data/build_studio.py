#!/usr/bin/env python3
# Build data/studio.js from the aggregated study outputs.
# Emits only numbers + public labels (diet-index names, country/region names).
# No study titles, no manuscript text.
import csv, json, os, collections

DESK = os.path.expanduser("~/Desktop")
def rd(p):
    with open(os.path.join(DESK, p), newline="") as f:
        return list(csv.DictReader(f))

# ---------- DIET (life course) ----------
di = rd("Study3_Diet_GDD/05_Master_Data/Index_Yearly.csv")
years_d = sorted({int(r["year"]) for r in di})
indices = ["AHEI", "DASH", "aMED", "PDQS"]
ages_d = ["15-49", "50+"]            # the two life-course bands shown in the hero figure
sexes_d = ["Both", "Men", "Women"]
score = {}
for ix in indices:
    score[ix] = {}
    for sx in sexes_d:
        score[ix][sx] = {}
        for ag in ages_d:
            ser = []
            for y in years_d:
                m = [r for r in di if r["index"] == ix and r["Sex"] == sx and r["age_group"] == ag and int(r["year"]) == y]
                ser.append(round(float(m[0]["score"]), 1) if m else None)
            score[ix][sx][ag] = ser
diet = {"years": years_d, "indices": indices, "ages": ages_d, "sexes": sexes_d, "score": score}

# ---------- AFRICA (double burden) ----------
af = rd("Africa Obesity Study /Older files /SSA_Global_Master_Table.csv")
years_a = sorted({int(r["year"]) for r in af})
def pct(v):
    try: return round(float(v) * 100, 1)
    except: return None
loc = collections.OrderedDict()
for r in af:
    name = r["location"]
    if r["region"] == "Global":   # keep only the African countries; global handled separately if present
        pass
    loc.setdefault(name, {"region": r["region"], "obese": {"Men": [None]*len(years_a), "Women": [None]*len(years_a)},
                                                 "under": {"Men": [None]*len(years_a), "Women": [None]*len(years_a)}})
    yi = years_a.index(int(r["year"]))
    if r["sex"] in ("Men", "Women"):
        loc[name]["obese"][r["sex"]][yi] = pct(r["prev_obese"])
        loc[name]["under"][r["sex"]][yi] = pct(r["prev_under"])
# countries only (drop any 'Global'/region aggregate pseudo-locations), alpha order
countries_a = sorted([k for k in loc if loc[k]["region"] in ("Central", "East", "South", "West")])
africa = {"years": years_a, "order": countries_a,
          "loc": {k: loc[k] for k in countries_a}}

# ---------- ADULT (three decades) ----------
ap = rd("1212 adults study /02_Metadata/04_Master_Data_Final/3.Clean_Prevalence_Data.csv")
print("adult cohorts:", sorted({r["Cohort"] for r in ap}))
print("adult sexes:", sorted({r["Sex"] for r in ap}))
print("adult sample prevalence:", ap[0]["Weighted_Prevalence"])
years_u = sorted({int(r["Year"]) for r in ap})
# aggregate cohorts (population-weighted) -> overall prevalence per country/sex/year
acc = collections.defaultdict(lambda: [0.0, 0.0])   # (country,sex,year) -> [sum(prev*pop), sum(pop)]
both = collections.defaultdict(lambda: [0.0, 0.0])
names_u = {}
for r in ap:
    try:
        prev = float(r["Weighted_Prevalence"]); pop = float(r["Total_Population"]); y = int(r["Year"])
    except: continue
    names_u[r["ISO"]] = r["Country"]
    acc[(r["ISO"], r["Sex"], y)][0] += prev * pop; acc[(r["ISO"], r["Sex"], y)][1] += pop
    both[(r["ISO"], y)][0] += prev * pop; both[(r["ISO"], y)][1] += pop
# scale: detect fraction vs percent
mx = max(float(r["Weighted_Prevalence"]) for r in ap)
SCALE = 100.0 if mx <= 1.5 else 1.0
def series(iso, sex):
    out = []
    for y in years_u:
        if sex == "Both":
            s, w = both[(iso, y)]
        else:
            s, w = acc[(iso, sex, y)]
        out.append(round(s / w * SCALE, 1) if w > 0 else None)
    return out
# AAPC delta (overall) from regression delta if present
delta = {}
try:
    for r in rd("1212 adults study /02_Metadata/04_Master_Data_Final/2.Master_Regression_Delta.csv"):
        delta.setdefault(r["ISO"], []).append(float(r["AAPC"]))
except Exception as e:
    print("delta skip:", e)
isos_u = sorted(names_u, key=lambda i: names_u[i])
adult = {"years": years_u, "order": [names_u[i] for i in isos_u],
         "c": {names_u[i]: {"Both": series(i, "Both"), "Men": series(i, "Men"), "Women": series(i, "Women"),
                            "aapc": round(sum(delta[i])/len(delta[i]), 2) if i in delta and delta[i] else None}
               for i in isos_u}}
print("adult: %d countries, years %d-%d, scale=%g" % (len(isos_u), years_u[0], years_u[-1], SCALE))

out = {"diet": diet, "africa": africa, "adult": adult}
js = "window.STUDIO_DATA=" + json.dumps(out, separators=(",", ":")) + ";\n"
path = os.path.join(os.path.dirname(__file__), "studio.js")
with open(path, "w") as f:
    f.write(js)
print("wrote %s (%.1f KB)" % (path, len(js)/1024))
print("diet years:", years_d, "| africa countries:", len(countries_a), "| adult countries:", len(isos_u))
