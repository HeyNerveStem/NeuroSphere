"""
Canonical anatomical structure catalog for NeuroSphere 3D.

Every *mesh* structure here maps to exactly one BodyParts3D 3.0 element file
(FMA id). Group structures (lobes, hemispheres, regions) have no geometry of
their own: they are defined purely by their children, so a label is never
placed on an unrelated mesh.

Running this module writes content/structures.json, which both the frontend
and the FastAPI backend consume.

Coordinate convention of the shipped model (after conversion):
  +X = patient's LEFT, +Y = SUPERIOR, +Z = ANTERIOR   (right-handed "LSA")
BodyParts3D source convention is +X left, +Y posterior, +Z superior (mm).
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Explosion layers (used by layer-by-layer disassembly, in this order)
LAYER_CORTEX = 0          # external cerebral cortex (gyri / lobes)
LAYER_DEEP_CORTEX = 1     # insula, cingulate, parahippocampal, white matter, commissures
LAYER_SUBCORTICAL = 2     # basal nuclei, hippocampus, amygdala, ventricles, internal capsule
LAYER_DIENCEPHALON = 3
LAYER_BRAINSTEM = 4
LAYER_CEREBELLUM = 5

S: list[dict] = []


def group(id, name, parent, hemisphere="bilateral", groups=(), content=None, major=False, synonyms=()):
    S.append(dict(id=id, name=name, parentId=parent, kind="group", hemisphere=hemisphere,
                  groups=list(groups), contentId=content or id, majorSelect=major,
                  synonyms=list(synonyms)))


def mesh(id, name, parent, fma, layer, hemisphere="bilateral", groups=(), content=None,
         label_priority=2, synonyms=(), source_name=None, note=None):
    S.append(dict(id=id, name=name, parentId=parent, kind="mesh", hemisphere=hemisphere,
                  fma=fma, layer=layer, groups=list(groups), contentId=content or id,
                  labelPriority=label_priority, synonyms=list(synonyms),
                  sourceName=source_name, note=note, majorSelect=False))


def side(fn, l_args, r_args):
    fn(*l_args[0], **{**l_args[1], "hemisphere": "left"})
    fn(*r_args[0], **{**r_args[1], "hemisphere": "right"})


# ---------------------------------------------------------------- tree roots
group("brain", "Brain", None, content="brain", synonyms=["encephalon"])
group("cerebrum", "Cerebrum", "brain", synonyms=["telencephalon", "forebrain (part)"])
group("diencephalon", "Diencephalon", "brain", groups=["diencephalon"], synonyms=["interbrain"])
group("brainstem", "Brainstem", "brain", groups=["brainstem"], synonyms=["brain stem"])
group("visual-pathway", "Anterior visual pathway", "brain", groups=["visual-pathway"],
      synonyms=["optic pathway"])
group("cerebral-midline", "Midline & commissural structures", "cerebrum", content="cerebral-midline")

for sd, L, FMA in [
    ("left", "Left", dict(sfg="FMA72654", mfg="FMA72656", pre="FMA72662", post="FMA72666", smg="FMA72668",
                          ang="FMA72670", spl="BP49", stga="FMA72801", stgp="FMA72805", mtg="FMA72686",
                          itg="FMA72688", fus="FMA72690", phg="FMA72706", occ="FMA72976", ins="FMA72978",
                          asg="FMA72702", cing="FMA72718", hip="FMA72714", amy="FMA72833", cau="FMA72827",
                          put="FMA72829", gp="FMA72831", fx="FMA72925", ic="FMA72909", lv="FMA78450",
                          cp="FMA274029", thal="FMA258716", lgn="FMA73304", mgn="FMA73310", sc="FMA73423",
                          ic2="FMA73435", on="FMA50878", ot="FMA67936")),
    ("right", "Right", dict(sfg="FMA72653", mfg="FMA72655", pre="FMA72661", post="FMA72665", smg="FMA72667",
                            ang="FMA72669", spl="BP50", stga="FMA72800", stgp="FMA72804", mtg="FMA72685",
                            itg="FMA72687", fus="FMA72689", phg="FMA72705", occ="FMA72975", ins="FMA72977",
                            asg="FMA72701", cing="FMA72717", hip="FMA72713", amy="FMA72832", cau="FMA72826",
                            put="FMA72828", gp="FMA72830", fx="FMA72924", ic="FMA72908", lv="FMA78449",
                            cp="FMA274027", thal="FMA258714", lgn="FMA73303", mgn="FMA73309", sc="FMA73422",
                            ic2="FMA73434", on="FMA50875", ot="FMA62382")),
]:
    hem = f"{sd}-cerebral-hemisphere"
    group(hem, f"{L} cerebral hemisphere", "cerebrum", sd, content="cerebral-hemisphere")
    # Lobes (groups, majorSelect => clicking any gyrus in "Region" mode selects the lobe)
    group(f"{sd}-frontal-lobe", f"{L} frontal lobe", hem, sd, ["cortex"], "frontal-lobe", True)
    group(f"{sd}-parietal-lobe", f"{L} parietal lobe", hem, sd, ["cortex"], "parietal-lobe", True)
    group(f"{sd}-temporal-lobe", f"{L} temporal lobe", hem, sd, ["cortex"], "temporal-lobe", True)
    group(f"{sd}-insular-cortex", f"{L} insular cortex", hem, sd, ["cortex"], "insula", True,
          ["insula", "island of Reil", "insular lobe"])
    group(f"{sd}-basal-nuclei", f"{L} basal nuclei", hem, sd, ["basal-ganglia"], "basal-nuclei",
          synonyms=["basal ganglia (telencephalic part)", "corpus striatum + globus pallidus"])
    h = dict(hemisphere=sd)
    fl, pl, tl = f"{sd}-frontal-lobe", f"{sd}-parietal-lobe", f"{sd}-temporal-lobe"
    mesh(f"{sd}-superior-frontal-gyrus", f"{L} superior frontal gyrus", fl, FMA["sfg"], LAYER_CORTEX, sd, ["cortex"], "superior-frontal-gyrus")
    mesh(f"{sd}-middle-frontal-gyrus", f"{L} middle frontal gyrus", fl, FMA["mfg"], LAYER_CORTEX, sd, ["cortex"], "middle-frontal-gyrus")
    mesh(f"{sd}-precentral-gyrus", f"{L} precentral gyrus", fl, FMA["pre"], LAYER_CORTEX, sd, ["cortex", "motor"], "precentral-gyrus", synonyms=["primary motor cortex (M1)", "Brodmann area 4"])
    mesh(f"{sd}-postcentral-gyrus", f"{L} postcentral gyrus", pl, FMA["post"], LAYER_CORTEX, sd, ["cortex", "sensory"], "postcentral-gyrus", synonyms=["primary somatosensory cortex (S1)"])
    mesh(f"{sd}-supramarginal-gyrus", f"{L} supramarginal gyrus", pl, FMA["smg"], LAYER_CORTEX, sd, ["cortex"], "supramarginal-gyrus", synonyms=["Brodmann area 40"])
    mesh(f"{sd}-angular-gyrus", f"{L} angular gyrus", pl, FMA["ang"], LAYER_CORTEX, sd, ["cortex"], "angular-gyrus", synonyms=["Brodmann area 39"])
    mesh(f"{sd}-superior-parietal-lobule-precuneus", f"{L} superior parietal lobule & precuneus", pl, FMA["spl"], LAYER_CORTEX, sd, ["cortex"], "superior-parietal-lobule-precuneus",
         source_name=f"{sd} superior parietal lobule precuneus (BodyParts3D combined element)")
    mesh(f"{sd}-superior-temporal-gyrus-anterior", f"{L} superior temporal gyrus (anterior part)", tl, FMA["stga"], LAYER_CORTEX, sd, ["cortex", "auditory"], "superior-temporal-gyrus")
    mesh(f"{sd}-superior-temporal-gyrus-posterior", f"{L} superior temporal gyrus (posterior part)", tl, FMA["stgp"], LAYER_CORTEX, sd, ["cortex", "auditory", "language"], "superior-temporal-gyrus")
    mesh(f"{sd}-middle-temporal-gyrus", f"{L} middle temporal gyrus", tl, FMA["mtg"], LAYER_CORTEX, sd, ["cortex"], "middle-temporal-gyrus")
    mesh(f"{sd}-inferior-temporal-gyrus", f"{L} inferior temporal gyrus", tl, FMA["itg"], LAYER_CORTEX, sd, ["cortex", "visual"], "inferior-temporal-gyrus")
    mesh(f"{sd}-fusiform-gyrus", f"{L} fusiform gyrus", tl, FMA["fus"], LAYER_CORTEX, sd, ["cortex", "visual"], "fusiform-gyrus", synonyms=["occipitotemporal gyrus (lateral)"])
    mesh(f"{sd}-parahippocampal-gyrus", f"{L} parahippocampal gyrus", tl, FMA["phg"], LAYER_DEEP_CORTEX, sd, ["cortex", "limbic", "memory"], "parahippocampal-gyrus")
    mesh(f"{sd}-occipital-lobe", f"{L} occipital lobe", hem, FMA["occ"], LAYER_CORTEX, sd, ["cortex", "visual"], "occipital-lobe", label_priority=1)
    mesh(f"{sd}-insula", f"{L} insula (main gyri)", f"{sd}-insular-cortex", FMA["ins"], LAYER_DEEP_CORTEX, sd, ["cortex"], "insula")
    mesh(f"{sd}-accessory-short-gyrus", f"{L} accessory short gyrus of insula", f"{sd}-insular-cortex", FMA["asg"], LAYER_DEEP_CORTEX, sd, ["cortex"], "insula")
    mesh(f"{sd}-cingulate-gyrus", f"{L} cingulate gyrus", hem, FMA["cing"], LAYER_DEEP_CORTEX, sd, ["cortex", "limbic"], "cingulate-gyrus", label_priority=1)
    mesh(f"{sd}-hippocampus", f"{L} hippocampus", hem, FMA["hip"], LAYER_SUBCORTICAL, sd, ["limbic", "memory"], "hippocampus", label_priority=1, synonyms=["hippocampal formation (part)", "cornu Ammonis"])
    mesh(f"{sd}-amygdala", f"{L} amygdala", hem, FMA["amy"], LAYER_SUBCORTICAL, sd, ["limbic", "emotion"], "amygdala", label_priority=1, synonyms=["amygdaloid body", "amygdaloid complex"])
    mesh(f"{sd}-caudate-nucleus", f"{L} caudate nucleus", f"{sd}-basal-nuclei", FMA["cau"], LAYER_SUBCORTICAL, sd, ["basal-ganglia", "motor"], "caudate-nucleus", label_priority=1, synonyms=["caudate"])
    mesh(f"{sd}-putamen", f"{L} putamen", f"{sd}-basal-nuclei", FMA["put"], LAYER_SUBCORTICAL, sd, ["basal-ganglia", "motor"], "putamen", label_priority=1)
    mesh(f"{sd}-globus-pallidus", f"{L} globus pallidus", f"{sd}-basal-nuclei", FMA["gp"], LAYER_SUBCORTICAL, sd, ["basal-ganglia", "motor"], "globus-pallidus", label_priority=1, synonyms=["pallidum", "paleostriatum"])
    mesh(f"{sd}-fornix", f"{L} fornix", hem, FMA["fx"], LAYER_SUBCORTICAL, sd, ["limbic", "white-matter", "memory"], "fornix")
    mesh(f"{sd}-internal-capsule-anterior-limb", f"{L} internal capsule (anterior limb)", hem, FMA["ic"], LAYER_SUBCORTICAL, sd, ["white-matter"], "internal-capsule")
    mesh(f"{sd}-lateral-ventricle", f"{L} lateral ventricle", hem, FMA["lv"], LAYER_SUBCORTICAL, sd, ["ventricular"], "lateral-ventricle", label_priority=1)
    mesh(f"{sd}-choroid-plexus", f"{L} choroid plexus (lateral ventricle)", hem, FMA["cp"], LAYER_SUBCORTICAL, sd, ["ventricular"], "choroid-plexus")
    # Diencephalon
    mesh(f"{sd}-thalamus", f"{L} thalamus", "diencephalon", FMA["thal"], LAYER_DIENCEPHALON, sd, ["diencephalon", "sensory"], "thalamus", label_priority=1)
    mesh(f"{sd}-lateral-geniculate-body", f"{L} lateral geniculate body", "diencephalon", FMA["lgn"], LAYER_DIENCEPHALON, sd, ["diencephalon", "visual", "visual-pathway"], "lateral-geniculate-body", synonyms=["lateral geniculate nucleus (LGN)"])
    mesh(f"{sd}-medial-geniculate-body", f"{L} medial geniculate body", "diencephalon", FMA["mgn"], LAYER_DIENCEPHALON, sd, ["diencephalon", "auditory"], "medial-geniculate-body", synonyms=["medial geniculate nucleus (MGN)"])
    # Brainstem (midbrain tectum)
    mesh(f"{sd}-superior-colliculus", f"{L} superior colliculus", "midbrain", FMA["sc"], LAYER_BRAINSTEM, sd, ["brainstem", "visual"], "superior-colliculus")
    mesh(f"{sd}-inferior-colliculus", f"{L} inferior colliculus", "midbrain", FMA["ic2"], LAYER_BRAINSTEM, sd, ["brainstem", "auditory"], "inferior-colliculus")
    # Visual pathway
    mesh(f"{sd}-optic-nerve", f"{L} optic nerve (CN II)", "visual-pathway", FMA["on"], LAYER_DIENCEPHALON, sd, ["visual-pathway", "cranial-nerve", "visual"], "optic-nerve", synonyms=["cranial nerve II", "CN II"])
    mesh(f"{sd}-optic-tract", f"{L} optic tract", "visual-pathway", FMA["ot"], LAYER_DIENCEPHALON, sd, ["visual-pathway", "visual"], "optic-tract")

# Bilateral / midline meshes
mesh("orbital-and-straight-gyri", "Orbital & straight gyri (both hemispheres)", "cerebrum", "BP51", LAYER_CORTEX, "bilateral",
     ["cortex"], "orbital-and-straight-gyri", label_priority=1, synonyms=["orbitofrontal cortex (part)", "gyrus rectus"],
     source_name="orbital gyri straight gyrus (BodyParts3D combined bilateral element)",
     note="Single bilateral element in the source asset; not split by hemisphere.")
mesh("cerebral-white-matter", "Cerebral white matter", "cerebral-midline", "FMA61822", LAYER_DEEP_CORTEX, "bilateral",
     ["white-matter"], "cerebral-white-matter", label_priority=3, synonyms=["white matter of cerebral hemisphere", "centrum semiovale (part)"],
     note="Single bilateral surface in the source asset; it is a coarse envelope, not a tractography model.")
mesh("corpus-callosum", "Corpus callosum", "cerebral-midline", "FMA86464", LAYER_DEEP_CORTEX, "midline",
     ["white-matter", "commissural"], "corpus-callosum", label_priority=1)
mesh("commissure-of-fornix", "Commissure of fornix", "cerebral-midline", "FMA61970", LAYER_SUBCORTICAL, "midline",
     ["limbic", "white-matter", "commissural"], "fornix", synonyms=["hippocampal commissure", "psalterium"])
mesh("septum-pellucidum", "Septum pellucidum", "cerebral-midline", "FMA61844", LAYER_SUBCORTICAL, "midline",
     ["ventricular"], "septum-pellucidum")

group("hypothalamus", "Hypothalamus", "diencephalon", "midline", ["diencephalon", "autonomic"], "hypothalamus", True)
mesh("hypothalamus-other", "Hypothalamus (remaining parts)", "hypothalamus", "FMA62008nsn", LAYER_DIENCEPHALON, "midline",
     ["diencephalon", "autonomic"], "hypothalamus", label_priority=1,
     source_name="hypothalamus, nsn (not otherwise specified)",
     note="BodyParts3D element for hypothalamic tissue other than the separately modelled mammillary body and tuber cinereum.")
mesh("mammillary-body", "Mammillary bodies", "hypothalamus", "FMA74877", LAYER_DIENCEPHALON, "midline",
     ["diencephalon", "memory", "limbic"], "mammillary-body", synonyms=["corpora mammillaria"])
mesh("tuber-cinereum", "Tuber cinereum", "hypothalamus", "FMA62327", LAYER_DIENCEPHALON, "midline",
     ["diencephalon", "autonomic"], "tuber-cinereum")
mesh("pituitary-gland", "Pituitary gland", "diencephalon", "FMA13889", LAYER_DIENCEPHALON, "midline",
     ["endocrine"], "pituitary-gland", label_priority=1, synonyms=["hypophysis"],
     note="Endocrine gland suspended from the hypothalamus by the infundibulum; grouped here for navigation.")
group("epithalamus", "Epithalamus", "diencephalon", "midline", ["diencephalon"], "epithalamus", True)
mesh("pineal-gland", "Pineal gland", "epithalamus", "FMA62033", LAYER_DIENCEPHALON, "midline",
     ["diencephalon", "endocrine"], "pineal-gland", label_priority=1, synonyms=["pineal body", "epiphysis cerebri"])
mesh("habenula", "Habenula", "epithalamus", "FMA62032", LAYER_DIENCEPHALON, "midline",
     ["diencephalon"], "habenula", note="Modelled as a single midline element in the source asset.")
mesh("third-ventricle", "Third ventricle", "diencephalon", "FMA78454", LAYER_DIENCEPHALON, "midline",
     ["ventricular"], "third-ventricle", label_priority=2)
mesh("optic-chiasm", "Optic chiasm", "visual-pathway", "FMA62045", LAYER_DIENCEPHALON, "midline",
     ["visual-pathway", "visual"], "optic-chiasm", label_priority=1)

group("midbrain", "Midbrain", "brainstem", "midline", ["brainstem"], "midbrain", True, ["mesencephalon"])
mesh("midbrain-other", "Midbrain (remaining parts)", "midbrain", "FMA61993nsn", LAYER_BRAINSTEM, "midline",
     ["brainstem"], "midbrain", label_priority=2, source_name="midbrain, nsn (not otherwise specified)",
     note="Midbrain tissue not covered by the separately modelled colliculi and cerebral peduncles.")
mesh("cerebral-peduncles", "Cerebral peduncles", "midbrain", "FMA62394", LAYER_BRAINSTEM, "midline",
     ["brainstem", "motor"], "cerebral-peduncle", label_priority=2, synonyms=["peduncle of midbrain", "crus cerebri (part)"],
     note="Single element covering both peduncles. The substantia nigra lies within this region but is NOT separately segmented in the source asset.")
mesh("cerebral-aqueduct", "Cerebral aqueduct", "midbrain", "FMA78467", LAYER_BRAINSTEM, "midline",
     ["ventricular", "brainstem"], "cerebral-aqueduct", synonyms=["aqueduct of Sylvius", "mesencephalic duct"])
mesh("pons", "Pons", "brainstem", "FMA67943", LAYER_BRAINSTEM, "midline", ["brainstem"], "pons", label_priority=1)
mesh("medulla-oblongata", "Medulla oblongata", "brainstem", "FMA62004", LAYER_BRAINSTEM, "midline",
     ["brainstem", "autonomic"], "medulla-oblongata", label_priority=1, synonyms=["medulla", "myelencephalon"])
mesh("fourth-ventricle", "Fourth ventricle", "brainstem", "FMA78469", LAYER_BRAINSTEM, "midline",
     ["ventricular"], "fourth-ventricle")
mesh("cerebellum", "Cerebellum", "brain", "FMA67944", LAYER_CEREBELLUM, "bilateral",
     ["cerebellum", "motor"], "cerebellum", label_priority=1, synonyms=["little brain"],
     note="Single element in the source asset: cerebellar hemispheres and vermis are not separately segmented.")

# Requested-but-unavailable structures (shown in the UI as unavailable, never faked)
UNAVAILABLE = [
    dict(id="left-cerebellar-hemisphere", name="Left cerebellar hemisphere", parentId="cerebellum",
         reason="BodyParts3D 3.0 models the cerebellum as one element.",
         requiredAsset="A cerebellar parcellation (e.g. SUIT atlas lobules) converted to surface meshes."),
    dict(id="right-cerebellar-hemisphere", name="Right cerebellar hemisphere", parentId="cerebellum",
         reason="BodyParts3D 3.0 models the cerebellum as one element.",
         requiredAsset="A cerebellar parcellation (e.g. SUIT atlas lobules) converted to surface meshes."),
    dict(id="cerebellar-vermis", name="Cerebellar vermis", parentId="cerebellum",
         reason="BodyParts3D 3.0 models the cerebellum as one element.",
         requiredAsset="A cerebellar parcellation separating vermis from hemispheres."),
    dict(id="inferior-frontal-gyrus", name="Inferior frontal gyrus (incl. Broca's area)", parentId="cerebrum",
         reason="Not present as an element in BodyParts3D 3.0; the frontal lobe groups contain only superior, middle and precentral gyri plus the bilateral orbital/straight gyri element.",
         requiredAsset="A cortical parcellation including the pars opercularis/triangularis/orbitalis (e.g. Desikan-Killiany surfaces)."),
    dict(id="substantia-nigra", name="Substantia nigra", parentId="midbrain",
         reason="Lies within the cerebral peduncle element; not separately segmented.",
         requiredAsset="A high-resolution midbrain atlas (e.g. CIT168 subcortical atlas) converted to meshes."),
    dict(id="nucleus-accumbens", name="Nucleus accumbens", parentId="cerebrum",
         reason="Not present as an element in BodyParts3D 3.0.",
         requiredAsset="A subcortical atlas with ventral striatum labels (e.g. CIT168 or Harvard-Oxford subcortical)."),
    dict(id="medial-occipital-subdivisions", name="Cuneus / lingual gyrus / calcarine cortex", parentId="cerebrum",
         reason="BodyParts3D provides each occipital lobe as a single element.",
         requiredAsset="A cortical parcellation with medial occipital labels."),
    dict(id="cranial-nerves-iii-xii", name="Cranial nerves III–XII", parentId="brainstem",
         reason="Only the optic nerve (CN II) was integrated; other cranial-nerve elements were not part of this build.",
         requiredAsset="BodyParts3D cranial nerve elements or a dedicated cranial-nerve model, re-registered to the brain."),
    dict(id="major-white-matter-tracts", name="Major white-matter tracts (tractography)", parentId="cerebrum",
         reason="Only a coarse white-matter envelope, corpus callosum, fornix and anterior limb of internal capsule exist in the asset.",
         requiredAsset="A tractography atlas (e.g. HCP-842) converted to streamline or tube meshes."),
]


def build():
    ids = [s["id"] for s in S]
    assert len(ids) == len(set(ids)), "duplicate structure ids"
    known = set(ids)
    for s in S:
        assert s["parentId"] is None or s["parentId"] in known, (s["id"], s["parentId"])
    return S


if __name__ == "__main__":
    data = dict(structures=build(), unavailable=UNAVAILABLE,
                coordinateSystem=dict(x="patient left", y="superior", z="anterior", units="decimetres (source mm × 0.01)"))
    out = ROOT / "content" / "structures.json"
    out.write_text(json.dumps(data, indent=1))
    print(f"wrote {out} with {len(S)} structures ({sum(s['kind']=='mesh' for s in S)} meshes)")
