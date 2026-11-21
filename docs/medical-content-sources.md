# Medical content sources and review workflow

## Sources
All 67 references in `content/references.json` are public pages from: NINDS (NIH), MedlinePlus (NLM), NCBI Bookshelf/StatPearls, PubMed Central, OpenStax *Anatomy & Physiology 2e*, American Cancer Society, Cleveland Clinic, and the BodyParts3D paper (DOI). Each URL was confirmed to exist on the publisher's own listing before inclusion (recorded in `_meta`); **no URL was constructed from a pattern**. 61 are currently cited.

## Rules enforced
- Text is original educational prose written from those sources; nothing is copied.
- No prevalence figures, survival/success rates or diagnostic-criteria thresholds are stated. `validate_content.py` fails the build on unsourced numeric statistics (`%`, "per 100,000", "x out of y"); the only allowed exception is the 50% autosomal-dominant inheritance statement for Huntington's disease.
- Emerging research is kept in a separate, labelled section.
- Each structure–disease relationship stores: target (structure / group / contentId), association type (common / secondary / subtype), distribution (diffuse, regional, focal, scattered, network), evidence level (established / variable / emerging), explanation and references. One disease can map to many structures and vice versa.
- When the asset cannot represent the true site (e.g. substantia nigra, subarachnoid space, microscopic demyelination), the association says so explicitly.

## Review workflow
1. Author edits JSON in `content/` (anatomy entries keyed by `contentId`; diseases in `diseases_part*.json`).
2. Run `python3 scripts/content-validation/validate_content.py` — merges, derives relationships, validates.
3. A qualified reviewer checks the diff, then updates `lastReviewed` / `reviewStatus` per disease (and `_meta.lastReviewed` for anatomy).
4. CI runs the validator, unit tests and acceptance tests; the backend re-seeds automatically on the new content hash.

**Current status:** all content is marked *Draft — pending clinical reviewer sign-off*. It has not yet been reviewed by a clinician or neuroanatomist.
