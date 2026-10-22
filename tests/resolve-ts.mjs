// Plugin sources import siblings without extensions (bundler style); node needs ".ts" for them in tests.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (e) {
    if (e?.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw e;
    return next(`${specifier}.ts`, context);
  }
}
