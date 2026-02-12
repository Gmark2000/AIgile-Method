# NPM Publishing Guide - AIgile Method

This guide walks through publishing the AIgile Method package to npm.

## Prerequisites

### 1. NPM Account Setup
- Create an npm account at https://www.npmjs.com/signup if you don't have one
- Verify your email address
- (Optional) Enable 2FA for security: https://www.npmjs.com/settings/~/tfa

### 2. NPM Authentication
```bash
npm login
```

Verify authentication:
```bash
npm whoami
```

### 3. Check Package Availability
Verify the package name is available (or you own it):
```bash
npm view @mark-gozner/aigile-method
```

If it returns 404, the name is available. Otherwise, you'll see the current published version.

## Pre-Publish Checklist

### 1. Version Validation
- [ ] Update version in package.json if needed
- [ ] Update CHANGELOG.md with release notes
- [ ] Commit all changes: `git add . && git commit -m "chore: prepare v0.4.5 release"`

### 2. Build and Validate
```bash
# Validate bundles are generated correctly
npm run validate

# Ensure build artifacts exist
ls -lh dist/

# Preview package contents
npm pack --dry-run

# Create test tarball
npm pack
```

### 3. Local Testing
Test the package in a clean environment:
```bash
# Create test directory
mkdir -p /tmp/aigile-test && cd /tmp/aigile-test

# Initialize test project
npm init -y

# Install from local tarball
npm install ~/Projects/AI/AIgile-Method/mark-gozner-aigile-method-0.4.5.tgz

# Test CLI commands
npx aigile-method install --yes
npx aigile-method status
npx aigile-method list:agents

# Verify installation
ls -la .aigile-core .github/agents .vscode

# Cleanup
cd ~ && rm -rf /tmp/aigile-test
```

## Publishing Options

### Option 1: Manual Publish (Recommended for First Release)

```bash
# Ensure you're on the main branch
git checkout main
git pull origin main

# Validate everything is ready
npm run validate

# Publish to npm (with provenance)
npm publish --access public

# Tag the release in git
git tag v0.4.5
git push origin v0.4.5
```

### Option 2: Using Release Scripts

```bash
# Patch release (0.4.5 -> 0.4.6)
npm run release:patch

# Minor release (0.4.5 -> 0.5.0)
npm run release:minor

# Major release (0.4.5 -> 1.0.0)
npm run release:major
```

These scripts automatically:
1. Bump the version in package.json
2. Create a git commit and tag
3. Run `npm publish`

### Option 3: GitHub Actions (Automated)

#### Setup NPM Token
1. Generate npm token: https://www.npmjs.com/settings/~/tokens
   - Click "Generate New Token" → "Classic Token"
   - Select "Automation" type
   - Copy the token

2. Add to GitHub Secrets:
   - Go to: https://github.com/Gmark2000/AIgile-Method/settings/secrets/actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: paste your npm token
   - Click "Add secret"

#### Publish via GitHub Release
1. Create a GitHub release:
   ```bash
   # Push your changes
   git push origin main

   # Create and push a tag
   git tag v0.4.5
   git push origin v0.4.5

   # Or use GitHub CLI
   gh release create v0.4.5 --title "Release v0.4.5" --notes "See CHANGELOG.md"
   ```

2. The workflow will automatically:
   - Run validation
   - Build bundles
   - Publish to npm
   - Add npm package link to release notes

#### Manual Workflow Trigger
Alternatively, trigger the workflow manually:
1. Go to: https://github.com/Gmark2000/AIgile-Method/actions/workflows/publish.yml
2. Click "Run workflow"
3. Select version type (patch/minor/major)
4. Click "Run workflow"

## Post-Publish Verification

### 1. Verify Package on NPM
```bash
# Check package info
npm view @mark-gozner/aigile-method

# Check version
npm view @mark-gozner/aigile-method version

# Check all versions
npm view @mark-gozner/aigile-method versions

# View package page
open https://www.npmjs.com/package/@mark-gozner/aigile-method
```

### 2. Test Installation from NPM
```bash
# Test npx (no install)
npx @mark-gozner/aigile-method install --yes

# Test global install
npm install -g @mark-gozner/aigile-method
aigile --help
aigile install

# Test as dependency
mkdir test-project && cd test-project
npm init -y
npm install @mark-gozner/aigile-method
```

### 3. Update Documentation
- [ ] Update README.md installation instructions if needed
- [ ] Update docs/orchestrator-guide.md if needed
- [ ] Announce on social media, blog, or relevant communities

## Troubleshooting

### Package Already Exists
If you get an error that the package already exists, you have two options:
1. **Bump the version**: Update version in package.json to a higher number
2. **Unpublish** (only if published <24 hours ago):
   ```bash
   npm unpublish @mark-gozner/aigile-method@0.4.5
   ```

### Authentication Errors
```bash
# Re-login
npm logout
npm login

# Verify authentication
npm whoami

# Check token (if using CI)
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
```

### Build Failures
```bash
# Clean and rebuild
rm -rf dist/
npm run build

# Check for errors
npm run validate
```

### Permission Denied
If you get a 403 error:
1. Ensure you're logged in: `npm whoami`
2. Check package.json name matches your npm username scope
3. Verify `publishConfig.access` is set to `public`
4. Check if you have publish permissions for the package

## Version Management Strategy

### Semantic Versioning (SemVer)
- **Patch** (0.4.5 → 0.4.6): Bug fixes, documentation updates
- **Minor** (0.4.5 → 0.5.0): New features, backward-compatible changes
- **Major** (0.4.5 → 1.0.0): Breaking changes, API redesign

### Pre-release Versions
For testing before official release:
```bash
# Create pre-release version
npm version 0.5.0-beta.1

# Publish with next tag
npm publish --tag next

# Install pre-release
npm install @mark-gozner/aigile-method@next
```

## Maintenance

### Updating an Already Published Package
```bash
# 1. Make your changes
# 2. Update CHANGELOG.md
# 3. Commit changes
git add .
git commit -m "feat: add new feature"

# 4. Bump version and publish
npm run release:minor  # or patch/major

# 5. Push to GitHub
git push --follow-tags
```

### Deprecating Old Versions
```bash
# Deprecate a specific version
npm deprecate @mark-gozner/aigile-method@0.4.0 "Please upgrade to 0.4.5 for bug fixes"

# Deprecate all versions (soft unpublish)
npm deprecate @mark-gozner/aigile-method@* "Package has been renamed to @mark-gozner/aigile-v2"
```

### Unpublishing (Last Resort)
⚠️ **Warning**: Only works within 72 hours of publish
```bash
# Unpublish specific version
npm unpublish @mark-gozner/aigile-method@0.4.5

# Unpublish entire package
npm unpublish @mark-gozner/aigile-method --force
```

## Security Best Practices

1. **Enable 2FA** on your npm account
2. **Use provenance**: `npm publish --provenance` (requires npm 9.5.0+)
3. **Audit dependencies**: `npm audit` (we have zero dependencies!)
4. **Rotate tokens**: Regenerate npm tokens periodically
5. **Use GitHub Actions**: Reduces manual token exposure
6. **Review releases**: Always review `npm pack --dry-run` before publishing

## Quick Reference

```bash
# Validate package
npm run validate

# Preview package
npm pack --dry-run

# Publish to npm
npm publish --access public

# Manual release with git tag
git tag v0.4.5 && git push --tags
npm publish

# Automated release
npm run release:patch   # 0.4.5 → 0.4.6
npm run release:minor   # 0.4.5 → 0.5.0
npm run release:major   # 0.4.5 → 1.0.0

# Check published package
npm view @mark-gozner/aigile-method
```

## Resources

- [NPM Publishing Documentation](https://docs.npmjs.com/cli/v9/commands/npm-publish)
- [Semantic Versioning](https://semver.org/)
- [NPM Provenance](https://docs.npmjs.com/generating-provenance-statements)
- [GitHub Actions + NPM](https://docs.github.com/en/actions/publishing-packages/publishing-nodejs-packages)

---

**Package**: `@mark-gozner/aigile-method`  
**Current Version**: `0.4.5`  
**License**: Custom (SEE LICENSE)  
**Repository**: https://github.com/Gmark2000/AIgile-Method
