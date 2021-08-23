"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.presetBuildings = void 0;

var _subway_station = _interopRequireDefault(require("./preset/subway_station.json"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const presetBuildings = {
  subway_station: _subway_station.default
};
exports.presetBuildings = presetBuildings;