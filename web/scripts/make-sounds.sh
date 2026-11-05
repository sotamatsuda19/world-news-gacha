#!/bin/sh
# Turns the original recordings in ../sounds-original/ (not in git: large, 96 kHz WAV)
# into the small files the app plays, in public/sounds/. Run from web/: sh scripts/make-sounds.sh
#
# For each sound: cut out the useful part, fade its edges (no clicks), make it mono,
# raise or lower it so its loudest moment is at -1 dB, and save it as MP3.
# How loud each one plays in the app is set in src/lib/sound.ts.
# Sources and licenses: public/sounds/CREDITS.md
set -e
SRC=../sounds-original
OUT=public/sounds
mkdir -p "$OUT"

# name  source file  start(s)  end(s)
make() {
  name=$1; file=$2; start=$3; end=$4
  len=$(echo "$end - $start" | bc | sed "s|^\.|0.|")
  fadeout=$(echo "$len - 0.08" | bc | sed "s|^\.|0.|")
  cut="atrim=start=$start:end=$end,asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=$fadeout:d=0.08,aformat=channel_layouts=mono"
  # Pass 1: measure the peak. Pass 2: apply the gain that puts it at -1 dB.
  peak=$(ffmpeg -hide_banner -i "$SRC/$file" -af "$cut,volumedetect" -f null - 2>&1 | sed -n 's/.*max_volume: \(-*[0-9.]*\) dB.*/\1/p')
  gain=$(echo "-1 - ($peak)" | bc | sed "s|^\.|0.|; s|^-\.|-0.|")
  ffmpeg -hide_banner -loglevel error -y -i "$SRC/$file" -af "$cut,volume=${gain}dB" -ar 44100 -c:a libmp3lame -b:a 96k "$OUT/$name.mp3"
  echo "$name.mp3  ${len}s  peak ${peak} dB -> -1 dB (gain ${gain} dB)"
}

make envelope 444431__mtjohnson__sliding-envelope.wav        0.25 1.00
make tear     593146__21100375__tearing-open-an-envelope.wav 0.62 1.30
make slide    464302__eyesonlegs__paperslide.wav             0.05 1.60
make unfold   447931__breviceps__unfold-a-map.wav            0.00 1.42
make fold     510023__chumlee__doblando-papel.wav            4.78 5.50
