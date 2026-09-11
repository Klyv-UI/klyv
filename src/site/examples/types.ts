import type { ComponentType, ReactNode } from 'react'
import type { PreviewBackground, PropRow } from '../components/Doc'

/**
 * A compact spec for a component page.
 *
 * The 27 primitives have pages written by hand, because each one needed its own
 * argument. Every other page is the same handful of shapes repeated, so those
 * are described as data instead — which keeps 200+ pages consistent and makes
 * adding one a few lines rather than a file.
 *
 * `specimens` covers the static cases (variants, sizes, states). `Content` is a
 * real component, so a section that needs state — a playground, a live
 * interaction — is written as ordinary JSX with hooks.
 */
export interface ExampleSpecimen {
  /** The prop value or state being shown. */
  label: string
  hint?: string
  /** Stretch the cell to the full row width. */
  fill?: boolean
  node: ReactNode
}

export interface ExampleSection {
  title: string
  description?: string
  /** Static labelled cells. */
  specimens?: ExampleSpecimen[]
  /** Free-form section body. May use hooks. */
  Content?: ComponentType
  /** Lay specimens out vertically. */
  stack?: boolean
  background?: PreviewBackground
  /** Render the body without the preview frame — for grids of real cards. */
  bare?: boolean
  note?: ReactNode
}

export interface ComponentExamples {
  /** One paragraph: what it is, and the decision behind it. */
  description: string
  sections: ExampleSection[]
  props?: PropRow[]
}

export type ExampleModule = Record<string, ComponentExamples>
