// Runs once per server process (dev + prod) before any request is handled.
// Next.js auto-detects this file at the project root and invokes `register()`.
//
// Turbopack bundles this file for BOTH the Node and Edge runtimes regardless
// of the runtime check below. To keep node:dns out of the Edge bundle we
// indirect through a separate file via a guarded dynamic import — the
// bundler statically sees the runtime gate and excludes the import from the
// Edge build.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
