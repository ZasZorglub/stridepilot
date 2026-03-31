"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertTaper = insertTaper;
function insertTaper(curves) {
    return {
        curves,
        taperWeeks: [...curves.taperWeeks],
    };
}
