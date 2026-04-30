"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoliciesV1Module = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../../common/audit/audit.module");
const policies_v1_controller_1 = require("./policies.v1.controller");
const policies_v1_service_1 = require("./policies.v1.service");
let PoliciesV1Module = class PoliciesV1Module {
};
exports.PoliciesV1Module = PoliciesV1Module;
exports.PoliciesV1Module = PoliciesV1Module = __decorate([
    (0, common_1.Module)({
        imports: [audit_module_1.AuditModule],
        controllers: [policies_v1_controller_1.PoliciesV1Controller],
        providers: [policies_v1_service_1.PoliciesV1Service],
    })
], PoliciesV1Module);
//# sourceMappingURL=policies.v1.module.js.map