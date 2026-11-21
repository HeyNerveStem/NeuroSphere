import { useEffect, useRef } from 'react'
import { meshRegistry } from '@/three/registry'
import { useViewer } from '@/stores/viewerStore'
import { useAnimation } from '@/stores/animationStore'
import { transforms } from '@/stores/transformStore'
import { meshesOf } from '@/lib/anatomy'

/** Run `fn` once the 3D model has loaded (meshes registered). */
export function useWhenModelReady(fn: () => void, deps: unknown[]) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (meshRegistry.size > 0) fnRef.current()
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}

/** Keyboard alternatives to drag interactions (accessibility). */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return
      const v = useViewer.getState()
      const a = useAnimation.getState()
      const sel = v.selectedId
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) transforms.redo()
        else transforms.undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        transforms.redo()
        return
      }
      switch (e.key) {
        case 'Escape':
          v.select(null)
          break
        case ' ':
          e.preventDefault()
          a.toggle()
          break
        case 'f':
        case 'F':
          if (sel) v.requestCamera({ kind: 'focus', id: sel })
          break
        case 'h':
        case 'H':
          if (sel) v.toggleHidden(sel)
          break
        case 'i':
        case 'I':
          v.isolate(v.isolated ? null : sel)
          break
        case 'x':
        case 'X':
          v.setXray(!v.xray)
          break
        case 'd':
        case 'D':
          v.setMode(v.mode === 'dissect' ? 'explore' : 'dissect')
          break
        case 'r':
        case 'R':
          if (sel) transforms.returnToOriginal(meshesOf(sel))
          break
        case '1':
          v.requestCamera({ kind: 'preset', preset: 'anterior' })
          break
        case '2':
          v.requestCamera({ kind: 'preset', preset: 'posterior' })
          break
        case '3':
          v.requestCamera({ kind: 'preset', preset: 'left-lateral' })
          break
        case '4':
          v.requestCamera({ kind: 'preset', preset: 'right-lateral' })
          break
        case '5':
          v.requestCamera({ kind: 'preset', preset: 'superior' })
          break
        case '6':
          v.requestCamera({ kind: 'preset', preset: 'inferior' })
          break
        case 'ArrowLeft':
          a.step(-1)
          break
        case 'ArrowRight':
          a.step(1)
          break
        default:
          return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
