# IRONSHIFT — Transformation Lab

A browser-based configurator where you pick a vehicle, style it, name it, and watch it transform into a combat mech.

Everything is procedural: the cars, the robots, the textures and the sound are all generated in code. There are no model files and no audio files.

## Run it

```bash
npm install
npm run dev        # http://localhost:5230
npm run build      # production bundle in dist/
```

`/debug.html` is a development view:

| URL | Shows |
| --- | --- |
| `?v=coupe` | one car on its own |
| `?rig=all&t=3.7` | all four robots side by side |
| `?rig=van&play=0.5` | the transformation looping at half speed |

## Controls

| Input | Action |
| --- | --- |
| **Space** / Transform button | transform, or revert |
| Timeline slider | scrub through the sequence; this also freezes it |
| Drag / scroll | orbit and zoom the camera |
| **H** | hide the interface (for screenshots) |
| **C** | capture a PNG |
| **M** | mute |
| **R** | random name |

The share button copies a link that rebuilds the exact unit. The configuration is stored in the URL hash.

## The line-up

| Chassis | Based on | Robot class | Character |
| --- | --- | --- | --- |
| Sport Coupe | rear-engine 2+2 sports car | **Striker** | lean, fast, swept-fin helmet |
| Minivan | 8-seat people mover | **Warden** | broad guardian, grille chest, visor slit |
| Luxury SUV | mid-size performance SUV | **Sovereign** | commander, tall crest |
| Wedge Pickup | stainless wedge truck | **Juggernaut** | massive breacher, glass breastplate |

The proportions come from each real vehicle's published dimensions (length, width, height, wheelbase, tyre size). Names, badges and logos are deliberately original, so the project stays clear of anyone's trademarks.

## How it works

```
src/
  vehicles/   body.ts     loft-based car body; every panel is cut from the same cross-section grid
              specs.ts    the four vehicles: profile curves, stations, lights, grilles, trim
              wheel.ts    lathe tyres, spoked / aero rims, calipers
              car.ts      builds the panels and wheels as separate movable parts
  robot/      classes.ts  proportions, stats and bios per class
              endo.ts     internal mechanical parts, heads, weapons
  rig/        skeleton.ts two poses per bone: folded (car) and standing (robot)
              rig.ts      maps every car panel to a place on the robot and runs the timeline
  stage/      stage.ts    renderer, studio lighting, reflective floor, post-processing
              director.ts cinematic camera flights, keyed to sequence progress
              particles.ts sparks, dust, motes
  audio/      sound.ts    synthesized servos, metal clanks, impact, ignition
  ui/         the configurator panel, dossier and timeline
  app.ts      state machine: intro → drive-in → car ⇄ transform ⇄ robot
```

**The transformation.** Each bone and part has two local transforms:

- **A**: where it sits in the car.
- **B**: where it sits on the standing robot.

A part's A pose is computed automatically from its real position on the car. Parts ride their bones as the skeleton unfolds, and each one moves on its own timing window with an arc and a mechanical ease (a slow break-away, then a hard lock). A ground-contact pass keeps whatever is lowest (the wheels early on, the feet later) planted on the floor.

**Adding a vehicle.** Add a spec to `vehicles/specs.ts` with its side profile, plan width, beltline, wheel positions and panel stations. Every panel, the robot mapping and the UI silhouette are derived from that spec.
