/**
 * feature.modules → AreaRecord cluster mapping (F-101 port of
 * `scripts/scan/area_resolver.py`, F-037).
 *
 * Pure deterministic mapping. Reuses a {@link StructureSummary}
 * passed in by the caller to avoid a second walk of the project
 * tree.
 *
 * @module scan/areaResolver
 */
import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { join } from 'node:path';
const CLUSTER_DEPTH = 2;
const SOURCE_EXT_CANDIDATES = ['.py', '.ts', '.tsx', '.js', '.jsx', '.rs', '.go', '.md'];
function isFile(path) {
    try {
        return statSync(path).isFile();
    }
    catch {
        return false;
    }
}
function isDirectory(path) {
    try {
        return statSync(path).isDirectory();
    }
    catch {
        return false;
    }
}
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** Returns one AreaRecord per cluster of resolvable modules. */
export function resolveAreas(feature, projectRoot, structure) {
    const rawModules = [];
    if (Array.isArray(feature['modules'])) {
        for (const m of feature['modules']) {
            if (typeof m === 'string') {
                rawModules.push(m);
            }
            else if (isPlainObject(m) && typeof m['name'] === 'string') {
                rawModules.push(m['name']);
            }
        }
    }
    const featureId = typeof feature['id'] === 'string' ? feature['id'] : '';
    if (rawModules.length === 0) {
        return [];
    }
    const resolved = [];
    const unmapped = [];
    const topDirs = new Set(structure.top_dirs);
    const candidateFiles = [...structure.entity_candidate_files];
    for (const module of rawModules) {
        const path = tryResolve(module, projectRoot, topDirs, candidateFiles);
        if (path !== null) {
            resolved.push([module, path]);
        }
        else {
            unmapped.push(module);
        }
    }
    const clusters = new Map();
    for (const [module, path] of resolved) {
        const key = clusterKey(path).join('/');
        if (!clusters.has(key)) {
            clusters.set(key, []);
        }
        clusters.get(key).push([module, path]);
    }
    const areas = [];
    for (const key of [...clusters.keys()].sort()) {
        const items = [...clusters.get(key)].sort((a, b) => {
            if (a[0] !== b[0]) {
                return a[0] < b[0] ? -1 : 1;
            }
            return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
        });
        const modules = items.map(([m]) => m);
        const paths = dedupePreserveOrder(items.map(([, p]) => p));
        areas.push({
            slug: slugify(key),
            label: key,
            paths,
            modules,
            feature_id: featureId,
        });
    }
    for (const module of [...unmapped].sort()) {
        const digest = createHash('sha1').update(module).digest('hex').slice(0, 8);
        areas.push({
            slug: `unmapped-${digest}`,
            label: `unmapped:${module}`,
            paths: [],
            modules: [module],
            feature_id: featureId,
        });
    }
    return areas;
}
function tryResolve(module, projectRoot, topDirs, candidateFiles) {
    if (!module) {
        return null;
    }
    if (module.includes('/') || (module.includes('.') && !module.startsWith('.'))) {
        const candidate = join(projectRoot, module);
        if (isFile(candidate)) {
            return module.replace(/\\/g, '/');
        }
        if (isDirectory(candidate)) {
            return module.replace(/\\/g, '/');
        }
        for (const ext of SOURCE_EXT_CANDIDATES) {
            const withExt = join(projectRoot, `${module}${ext}`);
            if (isFile(withExt)) {
                return `${module}${ext}`.replace(/\\/g, '/');
            }
        }
        if (module.includes('/')) {
            const parent = module.slice(0, module.lastIndexOf('/'));
            if (isDirectory(join(projectRoot, parent))) {
                return parent.replace(/\\/g, '/');
            }
        }
    }
    const bare = module.split('/').pop();
    for (const entry of candidateFiles) {
        const stem = entry.split('/').pop().replace(/\.[^.]+$/, '');
        if (stem === bare) {
            return entry;
        }
    }
    if (topDirs.has(bare)) {
        return bare;
    }
    return null;
}
function clusterKey(relPath) {
    return relPath.split('/').slice(0, CLUSTER_DEPTH);
}
function slugify(label) {
    const slug = label.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return slug.length > 0 ? slug : 'area';
}
function dedupePreserveOrder(values) {
    const seen = new Set();
    const out = [];
    for (const value of values) {
        if (!seen.has(value)) {
            seen.add(value);
            out.push(value);
        }
    }
    return out;
}
//# sourceMappingURL=areaResolver.js.map