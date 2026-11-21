import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { InfoPanel } from './InfoPanel'
import { StructureTree } from './StructureTree'
import { useViewer } from '@/stores/viewerStore'

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('InfoPanel', () => {
  beforeEach(() => useViewer.getState().resetView())

  it('prompts for a selection when nothing is selected', () => {
    wrap(<InfoPanel />)
    expect(screen.getByText(/select a structure/i)).toBeInTheDocument()
  })

  it('shows hippocampus anatomy, functions and related conditions', () => {
    useViewer.setState({ selectedId: 'left-hippocampus', level: 'intermediate' })
    wrap(<InfoPanel />)
    expect(screen.getByTestId('info-title')).toHaveTextContent('Left hippocampus')
    expect(screen.getByText(/Formation of new episodic memories/)).toBeInTheDocument()
    expect(screen.getByText(/Spatial navigation/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: "Alzheimer's disease" })).toHaveAttribute(
      'href',
      '/diseases/alzheimers-disease',
    )
    expect(screen.getByText(/differ in mechanism/)).toBeInTheDocument()
  })

  it('beginner level uses plain-language text and hides references', () => {
    useViewer.setState({ selectedId: 'cerebellum', level: 'beginner' })
    wrap(<InfoPanel />)
    expect(screen.getByText(/little brain/i)).toBeInTheDocument()
    expect(screen.queryByText(/^References$/i)).not.toBeInTheDocument()
  })
})

describe('StructureTree', () => {
  it('searches and selects a structure', () => {
    wrap(<StructureTree />)
    fireEvent.change(screen.getByTestId('structure-search'), { target: { value: 'cerebellum' } })
    const results = screen.getByTestId('structure-results')
    fireEvent.click(results.querySelector('button')!)
    expect(useViewer.getState().selectedId).toBe('cerebellum')
  })

  it('lists unavailable structures instead of faking them', () => {
    wrap(<StructureTree />)
    fireEvent.change(screen.getByTestId('structure-search'), { target: { value: 'vermis' } })
    expect(screen.getByText(/not available in this model/i)).toBeInTheDocument()
  })
})
