/**
 * React-dom 16 bundles no type declarations, and no `@types/react-dom`
 * release matches the installed `@types/react` 19 and still types
 * ReactDOM.render (the 16.x/18.x lines drag in a conflicting second
 * `@types/react`, and the 19.x line dropped render). Declare the single
 * API the popup entry uses. Drop this file when React is upgraded and
 * matching `@types/react-dom` is installed.
 * @file Ambient type declarations for ReactDOM.render.
 */
declare module 'react-dom' {
    export function render(
        element: import('react').ReactElement,
        container: Element | null,
    ): void;
}
