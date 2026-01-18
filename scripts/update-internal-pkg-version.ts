import fs from "node:fs"
import path from "node:path"

const PACKAGES_DIR = path.resolve(__dirname, '../packages');
const PAYMASTER_DIR = path.resolve(__dirname, '../packages/paymaster');

// Step 1: Get versions of all internal packages
const packageVersions = {};
fs.readdirSync(PACKAGES_DIR).forEach((dir) => {
  if (dir === "paymaster") return;
  const pkgPath = path.join(PACKAGES_DIR, dir, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    // @ts-ignore
    packageVersions[pkg.name] = pkg.version;
  }
});

fs.readdirSync(PAYMASTER_DIR).forEach((dir) => {
  const pkgPath = path.join(PAYMASTER_DIR, dir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    // @ts-ignore
    packageVersions[pkg.name] = pkg.version;
  }
});

// Step 2: Replace workspace:* with actual versions
fs.readdirSync(PACKAGES_DIR).forEach((dir) => {
  if (dir === 'paymaster') return;
  const pkgPath = path.join(PACKAGES_DIR, dir, "package.json");
  if (!fs.existsSync(pkgPath)) return;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  let updated = false;

  ["dependencies", "devDependencies", "peerDependencies"].forEach((field) => {
    const deps = pkg[field];
    if (!deps) return;

    Object.entries(deps).forEach(([dep, version]) => {
      // @ts-ignore
      if (version === "workspace:*" && packageVersions[dep]) {
        // @ts-ignore
        deps[dep] = packageVersions[dep];
        updated = true;
      }
    });
  });

  if (updated) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`Updated ${pkg.name}`);
  }
});

fs.readdirSync(PAYMASTER_DIR).forEach((dir) => {
  const pkgPath = path.join(PAYMASTER_DIR, dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  let updated = false;

  ["dependencies", "devDependencies", "peerDependencies"].forEach((field) => {
    const deps = pkg[field];
    if (!deps) return;

    Object.entries(deps).forEach(([dep, version]) => {
      // @ts-ignore
      if (version === "workspace:*" && packageVersions[dep]) {
        // @ts-ignore
        deps[dep] = packageVersions[dep];
        updated = true;
      }
    });
  });

  if (updated) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`Updated ${pkg.name}`);
  }
});