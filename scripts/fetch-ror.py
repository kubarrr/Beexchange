"""Buduje data/institutions.json z oficjalnego zrzutu rejestru ROR (licencja CC0).

Pobiera najnowszy zrzut z Zenodo i wybiera wszystkie aktywne uczelnie świata
(ok. 30 tys.). Z flagą --europe tylko Europa plus Turcja i Cypr.

Uruchom: python scripts/fetch-ror.py [--europe]
"""
import io, json, pathlib, sys, urllib.request, zipfile

EXTRA_COUNTRIES = {"TR", "CY"}


def latest_dump_url():
    url = "https://zenodo.org/api/communities/ror-data/records?sort=newest&size=1"
    with urllib.request.urlopen(url, timeout=60) as r:
        hit = json.load(r)["hits"]["hits"][0]
    f = next(f for f in hit["files"] if f["key"].endswith(".zip"))
    print("Zrzut:", hit["metadata"]["title"])
    return f["links"]["self"]


def slim(o):
    names = o.get("names", [])
    display = next((n["value"] for n in names if "ror_display" in n["types"]), names[0]["value"] if names else "")
    labels = {n["lang"]: n["value"] for n in names if "label" in n["types"] and n.get("lang")}
    acronyms = [n["value"] for n in names if "acronym" in n["types"]]
    aliases = [n["value"] for n in names if "alias" in n["types"]]
    loc = (o.get("locations") or [{}])[0].get("geonames_details", {})
    site = next((l["value"] for l in o.get("links", []) if l.get("type") == "website"), None)
    return {
        "ror": o["id"].rsplit("/", 1)[-1],
        "name": display,
        "name_en": labels.get("en"),
        "name_pl": labels.get("pl"),
        "labels": sorted(set(labels.values()) - {display}),
        "acronyms": acronyms,
        "aliases": aliases[:5],
        "cc": loc.get("country_code"),
        "city": loc.get("name"),
        "website": site,
    }


def main():
    with urllib.request.urlopen(latest_dump_url(), timeout=300) as r:
        archive = zipfile.ZipFile(io.BytesIO(r.read()))
    name = next(n for n in archive.namelist() if n.endswith(".json"))
    orgs = json.loads(archive.read(name))

    rows = []
    for o in orgs:
        if o.get("status") != "active" or "education" not in o.get("types", []):
            continue
        loc = (o.get("locations") or [{}])[0].get("geonames_details", {})
        if "--europe" not in sys.argv or loc.get("continent_code") == "EU" or loc.get("country_code") in EXTRA_COUNTRIES:
            rows.append(slim(o))

    rows.sort(key=lambda r: (r["cc"] or "", r["name"]))
    path = pathlib.Path(__file__).resolve().parent.parent / "data" / "institutions.json"
    path.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("Zapisano", len(rows), "uczelni do", path)


if __name__ == "__main__":
    main()
