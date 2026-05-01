# Changelog

## 1.0.0

### Breaking Changes

- **Typed API**: `fields` is now `FormField[]` instead of `any`
- **ESM-first**: package is now `"type": "module"`

### Improvements

- Migrated from Rollup + tsc to Vite + vite-plugin-dts
- Upgraded to TypeScript 6
- Replaced `tap` tests with Vitest (8 tests with mocked fetch)
- Added proper TypeScript types for all interfaces (`FormField`, `FormFieldOption`, `FormResponse`)
- Refactored implementation to async/await (removed `.then()` chains)
- Removed unused dependencies: `@capacitor/docgen`, `@ionic/*`, `prettier-plugin-java`
- Added GitHub Actions CI and publish workflow
- Rewrote README with full API documentation
