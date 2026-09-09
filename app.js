// Compatibility entry for browsers that cached the pre-TypeScript index page.
// The current index.html loads src/main.tsx directly; this bridge lets one old
// page load complete so local development can unregister its stale service worker.
import "./src/main.tsx";
