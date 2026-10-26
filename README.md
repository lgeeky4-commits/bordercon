# BORDER CONTROL RP — Standalone v1.1

Fictional 4-player roleplay website with map marks, chat, browser photo/video capture, and push-to-talk walkie-talkie audio. This is not a real border, police, or location-tracking system.

## New in v1.1

**Camera photos:** Join the room, open **TAKE PHOTO**, allow camera access, optionally switch FRONT / REAR, select **TAKE PHOTO**, and then choose **SEND TO CHAT** or **PLACE ON MAP**. A photo is not shared until you press one of those buttons.

**Video clips:** Choose **RECORD VIDEO**, allow camera and (optionally) microphone access, press **START VIDEO** and then **STOP VIDEO**. Clips have an 8-second limit. Select **SEND TO CHAT** or **PLACE ON MAP**. If you choose the map, tap a point, add a title and notes, and save. Clips can be played from chat or their map-mark detail panel.

**Walkie-talkie:** Press and **hold HOLD TO TALK** to speak live to the other connected players. Release to stop. Only one unit can transmit at once, and the server enforces a 30-second maximum transmission. If you cannot hear other players, press **ENABLE SPEAKER**. Radio capture is never background or automatic.

## Existing features
- Maximum four online players in one shared room
- Status roster (Available / Patrol / At Post / Observing)
- Text chat and temporary room media
- Fictional illustrated map with checkpoint, roadblock, observation, patrol, and location marks
- Blocked-area outlines, map zoom/pan, marker log and creator-only deletion
- New photo/video map reports that can be inspected and removed by their creator

## Installation (GitHub + Render)

1. Extract this ZIP and put `server.js`, `border-room.js`, `package.json`, and `public/` at the repository root.
2. Deploy it as a Render **Web Service**, using `npm install` as the build command and `npm start` as the start command.
3. Open the HTTPS URL on up to four phones or computers. Opening the website from GitHub Pages alone will not provide multiplayer chat or radio signaling.
4. Join using a callsign, allow camera/microphone access when prompted, and explicitly start capture or transmission.

**Device compatibility:** Browser camera and microphone permissions need HTTPS or localhost, and may be interrupted when switching apps or locking a phone. Video uses MediaRecorder and live walkie-talkie audio uses WebRTC; browser and network compatibility vary. STUN is configured; restrictive networks may need a TURN relay for reliable radio audio. Recorded photos are capped at roughly 1.1 MB, video clips roughly 2.2 MB and 8 seconds, and up to 12 media messages / 12 media map marks are retained in server memory. The server does not save the files permanently; shared items are visible to other room players and are cleared on server restart. Do not use this demo for sensitive material or real operational communications.


## v1.2 — Theme Studio & Live Direction
- New theme button with six sliders: grit, grit size, hue, contrast, saturation, brightness.
- Edit individual panel background colors, fonts, text color, border line color, and patterns.
- 30 bundled SVG wallpapers; save up to eight locally named theme presets.
- Live one-tap moving dot with a rolling last-two-arrow trail.
- Two-tap simulated incoming route; synchronized with everyone in this four-person room.
- See `THEME_STUDIO_GUIDE.md` and `LIVE_MAP_GUIDE.md`.

## v1.3 — Map Zoom and Pan

The fictional reference map supports zoom from **100% to 500%**. Use `+` and `−` at the top of the map, a mouse wheel on desktop, or a two-finger pinch on a phone. Use `RESET` to restore the original view.

When zoomed in and in **VIEW MAP** mode, swipe or drag the map to move around. You can also press **PAN MAP** to explicitly switch to panning; this turns off active live-mark placement. Press it again to return to normal controls. Pan position is kept within the reference image bounds so you cannot drag it entirely off-screen.

The map image, shared checkpoints, notes, blocked areas, media pins, live mark, and rolling direction arrows all pan and zoom together. Press a marking tool when you want to place a location again. Two-finger pinching works without submitting a marker.

Because this is an image-based fictional map, zoom enlarges the original pixels; it does not download higher-resolution geographic details.
