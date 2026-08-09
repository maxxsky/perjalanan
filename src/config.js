export const CONFIG = {
  player: {
    walkSpeed: 4.0,
    turnSpeed: 8.0,
    partnerOffset: 0.7,
    terrainSmooth: 15,
  },
  camera: {
    distance: 12,
    height: 6,
    lookAtHeight: 1.5,
    followLerp: 3.0,
    fov: 55,
    recenterDot: 0.95,
    idleRecenterLerp: 2.0,
  },
  input: {
    joystickRadius: 60,
    deadzone: 0.15,
  },
  world: {
    pathWidth: 3.5,
    bounds: { minX: -30, maxX: 60, minZ: -140, maxZ: 140 },
    boundsPushback: 6.0,
    fogNear: 60,
    fogFar: 220,
    treeCount: 400,
  },
  terrain: {
    segmentsX: 100,
    segmentsZ: 150,
    sizeX: 200,
    sizeZ: 300,
  },
};
