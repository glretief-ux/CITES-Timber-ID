#!/usr/bin/env python3
"""Build common-name and synonym search data for the Fauna and Flora tabs.

    python tools/build_names.py path/to/Index_of_CITES_Species_YYYY-MM-DD.pdf      (needs: pip install pymupdf)

Input: "Index of CITES Species" PDF (Species+ / CITES Secretariat). It lists common names
(English/Spanish/French) -> scientific name, and synonyms ("Old name = accepted name").
Output (lazy-loaded by docs/search.html; run tools/build_checklist.py first):
  docs/names-fauna.json, docs/names-flora.json
    {"c": [[common name, "E|S|F", target], ...], "s": {synonym: accepted name}}
Source: Checklist of CITES species, UNEP-WCMC / CITES Secretariat.
"""
import fitz, re, json, unicodedata, collections, sys
ACC={"´":"́","`":"̀","¨":"̈","ˆ":"̂","˜":"̃","¸":"̧","ˇ":"̌","˚":"̊","¯":"̄","˘":"̆","˝":"̋"}
def fix(s):
    s=s.replace("ı","i")
    s=re.sub("(["+re.escape("".join(ACC))+"])([A-Za-z])", lambda m: m.group(2)+ACC[m.group(1)], s)
    return unicodedata.normalize("NFC",s)
CN=re.compile(r"^(?P<name>[^=]+?) \((?P<lang>[ESF])\): (?P<sci>.+)$")
def parse(pdf):
    doc=fitz.open(pdf)
    end=len(doc)
    for i in range(530,len(doc)):
        if re.match(r"\s*KEY TO", doc[i].get_text("text")[:80], re.I): end=i; break
    common=[]; syn={}
    for kind,rng in (("fauna",range(7,530)),("flora",range(530,end))):
        lines=[]
        for i in rng:
            lines+= [fix(l.strip()) for l in doc[i].get_text("text").split("\n") if l.strip()]
        for j,l in enumerate(lines):
            m=CN.match(l)
            if m:
                sci=re.sub(r"\s*\((Aves|Mammalia|Reptilia|Amphibia|Insecta|Arachnida|Anthozoa|Hydrozoa|Bivalvia|Gastropoda|Actinopteri|Elasmobranchii|Holothuroidea|Sarcopterygii|Cephalaspidomorphi|Hirudinoidea|Actinistia|Dipneusti|Coelacanthi|[A-Z][a-z]+)\)$","",m["sci"].strip())
                targets=[t.strip() for t in sci.split(" / ") if t.strip()]
                common.append((m["name"].strip(),m["lang"],targets,kind)); continue
            if " = " in l:
                left,right=l.split(" = ",1)
                if not re.match(r"^[A-Z][a-z]+ [a-z-]+",left):
                    if j>0 and not CN.match(lines[j-1]): left=lines[j-1]+" "+left
                lw=re.match(r"^([A-Z][a-z]+) ([a-z-]+)\b",left)
                rw=right.split()
                if not lw or not rw or not re.match(r"^[A-Z][a-z]+$",rw[0]): continue
                if len(rw)>=2 and re.match(r"^[a-z-]+$",rw[1]): acc=rw[0]+" "+rw[1]
                elif len(rw)==1 and j+1<len(lines) and re.match(r"^[a-z-]+\b",lines[j+1]): acc=rw[0]+" "+lines[j+1].split()[0]
                else: continue
                syn[(lw[1]+" "+lw[2]).lower()]=acc.lower()
    return common,syn

def main(pdf):
    import os
    root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    common,syn=parse(pdf)
    for kind in ("fauna","flora"):
        cl=json.load(open(os.path.join(root,"docs",f"checklist-{kind}.json"),encoding="utf-8"))
        S=cl["S"]; known={t[0].lower() for t in cl["T"]}
        known|={t[0].lower().split()[0] for t in cl["T"]}|{S[t[2]].lower() for t in cl["T"]}|{S[t[3]].lower() for t in cl["T"]}
        c=[]
        for name,lang,targets,k in common:
            if k!=kind: continue
            tg=" / ".join(targets)
            c.append([name,lang,tg])
        c.sort(key=lambda x:(x[0].lower(),x[1]))
        s={a:b for a,b in syn.items() if a!=b and b in known and a not in known}
        s={a:s[a] for a in sorted(s)}
        # keep only synonyms whose accepted taxon belongs to this kingdom's checklist
        out={"kind":kind,"c":c,"s":s}
        p=os.path.join(root,"docs",f"names-{kind}.json")
        json.dump(out,open(p,"w",encoding="utf-8"),ensure_ascii=False,separators=(",",":"))
        print(kind,len(c),"common names,",len(s),"synonyms,",round(os.path.getsize(p)/1e6,2),"MB")
if __name__=="__main__":
    if len(sys.argv)!=2: sys.exit(__doc__)
    main(sys.argv[1])
