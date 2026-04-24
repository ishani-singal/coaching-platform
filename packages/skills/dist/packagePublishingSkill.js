"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPackageWithPrograms = void 0;
exports.assemblePackage = assemblePackage;
exports.publishPackage = publishPackage;
exports.unpublishPackage = unpublishPackage;
const tools_1 = require("@coaching/tools");
Object.defineProperty(exports, "getPackageWithPrograms", { enumerable: true, get: function () { return tools_1.getPackageWithPrograms; } });
const sdk_1 = require("@coaching/sdk");
async function assemblePackage(coachId, personaSnapshotId, title, programIds, pricing) {
    const pkg = await (0, tools_1.createPackage)(coachId, personaSnapshotId, title, pricing.model, pricing.priceUsd);
    for (let i = 0; i < programIds.length; i++) {
        await (0, tools_1.addProgramToPackage)(pkg.packageId, programIds[i], i);
    }
    return pkg;
}
async function publishPackage(packageId) {
    await (0, tools_1.publishPackage)(packageId);
}
async function unpublishPackage(packageId) {
    await sdk_1.supabase.from('coaching_packages').update({ is_published: false }).eq('package_id', packageId);
}
//# sourceMappingURL=packagePublishingSkill.js.map