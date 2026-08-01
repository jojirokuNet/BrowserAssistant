/**
 * react-dom 16 bundles no type declarations, and no @types/react-dom
 * release both matches the installed @types/react 19 and still types
 * ReactDOM.render (the 16.x/18.x lines drag in a conflicting second
 * @types/react; the 19.x line dropped render). Declare the single API
 * the popup entry uses; drop this file when React is upgraded and
 * matching @types/react-dom is installed.
 */
declare module 'react-dom' {
    export function render(
        element: import('react').ReactElement,
        container: Element | null,
    ): void;
}
