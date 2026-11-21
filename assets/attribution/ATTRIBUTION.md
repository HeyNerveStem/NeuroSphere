# Asset attribution

## 3D brain model — BodyParts3D

- **Attribution (required):** BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan
- **License:** Creative Commons Attribution-ShareAlike 2.1 Japan — https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en (full text: `../licenses/BodyParts3D-LICENSE.txt`)
- **Original database:** BodyParts3D/Anatomography 3.0 (release 2011-09-15), Database Center for Life Science (DBCLS), Japan. Archive DOI: 10.18908/lsdba.nbdc00837-000
- **Retrieved via:** the binary-STL conversion at https://github.com/Kevin-Mattheus-Moerman/BodyParts3D (MIT-licensed code; model content CC BY-SA 2.1 JP)
- **Citation:** Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K. BodyParts3D: 3D structure database for anatomical concepts. *Nucleic Acids Res.* 2009;37(Database issue):D782–5. doi:10.1093/nar/gkn613

### Derivative work
`assets/processed-models/brain.glb` (and its copy in `frontend/public/models/`) is a derivative: 86 elements re-oriented to an LSA frame, centred, quadric-decimated (≈2.01 M → 0.34 M triangles), re-centred per element and meshopt-compressed by `scripts/model-optimization/`. **It is distributed under the same CC BY-SA 2.1 JP license**, and the attribution above must accompany any redistribution. Source-file SHA-1 hashes are recorded per mesh in `assets/model-manifest.json`.

## Software
Third-party libraries are used under their own licenses (MIT/Apache-2.0/BSD), listed in `frontend/package.json` and `backend/requirements.txt`.

## Medical content
Educational text was written for this project and cites public sources (NINDS, MedlinePlus, NCBI Bookshelf, OpenStax, American Cancer Society, Cleveland Clinic, PubMed Central). No text was copied from those sources. See `docs/medical-content-sources.md`.
