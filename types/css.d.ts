/**
 * Declares the stylesheet subpaths so `import 'klyvui/styles.css'` type-checks.
 *
 * Without a `types` condition on those exports, TypeScript reports TS2882 for a
 * side-effect import of a file it cannot resolve a declaration for — which is a
 * red squiggle on the very first line a consumer writes.
 */
export {}
