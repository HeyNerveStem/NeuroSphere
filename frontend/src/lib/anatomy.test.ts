import { describe, expect, it } from 'vitest'
import {
  ANATOMY, DISEASES, MANIFEST, MESH_IDS, MODULES, REFERENCES, STRUCTURES, diseasesForStructure, meshesOf, resolveTarget,
  selectionTarget,
} from './anatomy'
import { diseaseHighlight } from './diseaseViz'
import { searchDiseases, searchStructures, unifiedSearch } from './search'

describe('anatomical model integrity', () => {
  it('every mesh structure has exactly one manifest mesh and vice versa', () => {
    const manifestIds = MANIFEST.meshes.map((m) => m.meshName).sort()
    expect(manifestIds).toEqual([...MESH_IDS].sort())
    expect(new Set(STRUCTURES.map((s) => s.id)).size).toBe(STRUCTURES.length)
  })
  it('every structure has anatomy content', () => {
    for (const s of STRUCTURES) expect(ANATOMY[s.contentId], s.id).toBeTruthy()
  })
  it('bounding boxes and positions are finite', () => {
    for (const m of MANIFEST.meshes) [...m.originalPosition, ...m.boundsLocal.flat()].forEach((v) => expect(Number.isFinite(v)).toBe(true))
  })
})

describe('selection resolution', () => {
  it('region mode resolves a gyrus to its lobe; detailed mode keeps the gyrus', () => {
    expect(selectionTarget('left-superior-frontal-gyrus', 'region')).toBe('left-frontal-lobe')
    expect(selectionTarget('left-superior-frontal-gyrus', 'detailed')).toBe('left-superior-frontal-gyrus')
    expect(selectionTarget('cerebellum', 'region')).toBe('cerebellum')
    expect(selectionTarget('left-hippocampus', 'region')).toBe('left-hippocampus')
  })
  it('resolveTarget handles structure ids, group ids and contentIds', () => {
    expect(resolveTarget('hippocampus').sort()).toEqual(['left-hippocampus', 'right-hippocampus'])
    expect(resolveTarget('left-frontal-lobe')).toHaveLength(3)
    expect(resolveTarget('frontal-lobe')).toHaveLength(6)
    expect(meshesOf('brain')).toHaveLength(MESH_IDS.length)
  })
})

describe('medical content integrity', () => {
  it('all disease associations resolve to real meshes and all references exist', () => {
    for (const d of DISEASES) {
      expect(d.references.length).toBeGreaterThan(0)
      for (const r of d.references) expect(REFERENCES[r], `${d.id}:${r}`).toBeTruthy()
      for (const a of d.associations) expect(resolveTarget(a.target).length, `${d.id}:${a.target}`).toBeGreaterThan(0)
    }
    for (const r of Object.values(REFERENCES)) expect(r.url).toMatch(/^https:\/\//)
  })
  it('hippocampus lists the expected related conditions', () => {
    const ids = diseasesForStructure('left-hippocampus').map((x) => x.disease.id)
    expect(ids).toEqual(expect.arrayContaining(['alzheimers-disease', 'temporal-lobe-epilepsy', 'hypoxic-ischemic-brain-injury']))
    expect(ids).not.toContain('brain-metastases')
    expect(ids).not.toContain('meningitis')
  })
  it('a structure can relate to many diseases and a disease to many structures', () => {
    expect(diseasesForStructure('thalamus' in ANATOMY ? 'left-thalamus' : 'brain').length).toBeGreaterThan(3)
    const ad = DISEASES.find((d) => d.id === 'alzheimers-disease')!
    expect(Object.keys(diseaseHighlight(ad)).length).toBeGreaterThan(5)
  })
  it('primary association wins when a mesh is targeted more than once', () => {
    const ad = DISEASES.find((d) => d.id === 'alzheimers-disease')!
    expect(diseaseHighlight(ad)['left-hippocampus']).toBe('primary')
  })
  it('every tour highlight resolves', () => {
    for (const m of MODULES) for (const s of m.steps) for (const t of s.highlight) expect(resolveTarget(t).length, `${m.id}:${t}`).toBeGreaterThan(0)
  })
})

describe('search', () => {
  it('finds structures by name, synonym and function', () => {
    expect(searchStructures('hippocampus')[0].name).toMatch(/hippocampus/i)
    expect(searchStructures('cerebellum')[0].id).toBe('cerebellum')
    expect(searchStructures('frontal lobe')[0].id).toMatch(/frontal-lobe/)
    expect(searchStructures('primary motor cortex')[0].id).toMatch(/precentral/)
    expect(searchStructures('memory').map((h) => h.id)).toEqual(expect.arrayContaining(['left-hippocampus']))
  })
  it('finds diseases and symptom topics', () => {
    expect(searchDiseases("parkinson's disease")[0].id).toBe('parkinsons-disease')
    expect(searchDiseases('stroke').map((h) => h.id)).toEqual(expect.arrayContaining(['ischemic-stroke', 'hemorrhagic-stroke']))
    expect(unifiedSearch('tremor').topics.length).toBeGreaterThan(0)
  })
})
