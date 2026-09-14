import { Closing } from './landing/Closing'
import { Developer } from './landing/Developer'
import { Hero } from './landing/Hero'
import { HowItWorks } from './landing/HowItWorks'
import { Parts } from './landing/Parts'
import { Platform } from './landing/Platform'
import { Proof } from './landing/Proof'
import { Quality } from './landing/Quality'
import { Screens } from './landing/Screens'
import { Theming } from './landing/Theming'
import { Why } from './landing/Why'
import { Workspace } from './landing/Workspace'
import './landing/landing.css'

/**
 * The front page.
 *
 * It answers a visitor's questions in the order they ask them: what is this
 * (the hero and its numbers), why this one (four reasons, each with evidence),
 * how would I use it (four steps), can it build a real screen (live blocks),
 * what else comes with it (the platform), what are the parts, can I make it
 * mine (one colour, and a workspace of my own), how does it feel in code, can
 * I trust it in production — and then one command to start.
 *
 * Every specimen on it is a real component, running — not a screenshot and not
 * a mock. That is the entire argument the page is making, so faking any part
 * of it would be self-defeating. Each section lives in `./landing`.
 */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <Proof />
      <Why />
      <HowItWorks />
      <Screens />
      <Platform />
      <Parts />
      <Theming />
      <Developer />
      <Workspace />
      <Quality />
      <Closing />
    </>
  )
}
