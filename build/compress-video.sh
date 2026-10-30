#!/usr/bin/env bash
# Kompres SEMUA video unggahan, apa pun jalur masuknya:
#   1) upload/video/*        -> hasilnya assets/video/NAMA.mp4 (file asli dihapus)
#   2) assets/video/*        -> video yang belum dikompres diganti hasil kompres
#      (misalnya masuk lewat ZIP, unggah ke folder, atau langsung dari GitHub)
# Video yang sudah dikompres diberi penanda "xpeng-compressed" di metadata,
# jadi tidak diproses ulang setiap build.
# Aturan hasil: maks 90 detik, sisi terpanjang 1280px, tanpa suara, H.264 CRF 29, faststart.
# Jika kompres gagal, file asli dibiarkan (tidak ada yang hilang).
set -u
shopt -s nullglob nocaseglob
ROOT="${1:-.}"; cd "$ROOT" || exit 1
TAG="xpeng-compressed"

need_ffmpeg() {
  command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1 && return 0
  sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg
}

# true (0) jika video perlu dikompres
needs_compress() {
  local f="$1" ext="${1##*.}"; ext="${ext,,}"
  local tag; tag=$(ffprobe -v error -show_entries format_tags=comment -of default=nw=1:nk=1 "$f" 2>/dev/null)
  [ "$tag" = "$TAG" ] && return 1
  [ "$ext" != "mp4" ] && return 0
  local info; info=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,pix_fmt -show_entries format=duration,bit_rate -of default=nw=1 "$f" 2>/dev/null) || return 0
  local codec w h pix dur br
  codec=$(sed -n 's/^codec_name=//p' <<<"$info" | head -1); w=$(sed -n 's/^width=//p' <<<"$info" | head -1); h=$(sed -n 's/^height=//p' <<<"$info" | head -1)
  pix=$(sed -n 's/^pix_fmt=//p' <<<"$info" | head -1); dur=$(sed -n 's/^duration=//p' <<<"$info" | head -1); br=$(sed -n 's/^bit_rate=//p' <<<"$info" | head -1)
  [ -z "$codec" ] && return 1                        # bukan video yang bisa dibaca: biarkan
  [ -n "$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$f" 2>/dev/null)" ] && return 0   # ada suara
  [ "$codec" != "h264" ] && return 0
  [ "$pix" != "yuv420p" ] && return 0
  local mx=$(( w > h ? w : h )); [ "$mx" -gt 1280 ] && return 0
  awk -v d="${dur:-0}" 'BEGIN{exit !(d>90.5)}' && return 0
  awk -v b="${br:-0}" 'BEGIN{exit !(b>3500000)}' && return 0   # lebih dari ±3,5 Mbps
  return 1                                           # sudah ringan dan sesuai aturan
}

# kompres $1 -> $2 (mp4)
encode() {
  ffmpeg -nostdin -y -v error -i "$1" -t 90 -an \
    -vf "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))':flags=lanczos,fps=30" \
    -c:v libx264 -preset slow -crf 29 -pix_fmt yuv420p -movflags +faststart \
    -metadata comment="$TAG" -f mp4 "$2"
}

poster() { # $1 = mp4, $2 = jpg (hanya jika belum ada)
  [ -f "$2" ] || ffmpeg -nostdin -y -v error -i "$1" -frames:v 1 -vf "scale='min(960,iw)':-2" -q:v 5 "$2" || true
}

cands=(); for e in mp4 mov m4v webm mkv avi 3gp; do cands+=(upload/video/*.$e assets/video/*.$e); done
[ ${#cands[@]} -eq 0 ] && { echo "Tidak ada video untuk diproses."; exit 0; }
need_ffmpeg || { echo "ffmpeg tidak bisa dipasang, kompres dilewati (file asli aman)."; exit 0; }
mkdir -p assets/video
done_n=0; skip_n=0; fail_n=0
for f in "${cands[@]}"; do
  [ -f "$f" ] || continue
  b=$(basename "${f%.*}"); out="assets/video/$b.mp4"; tmp="assets/video/.tmp-$b.mp4"
  from_upload=0; [[ "$f" == upload/video/* ]] && from_upload=1
  if [ $from_upload -eq 0 ] && ! needs_compress "$f"; then echo "Lewati (sudah ringan/terkompres): $f"; skip_n=$((skip_n+1)); poster "$f" "assets/video/$b.jpg"; continue; fi
  before=$(stat -c %s "$f"); echo "Kompres $f"
  if encode "$f" "$tmp" && [ -s "$tmp" ]; then
    [ "$f" != "$out" ] && rm -f "$f"
    mv -f "$tmp" "$out"; poster "$out" "assets/video/$b.jpg"
    echo "  $(numfmt --to=iec "$before") -> $(numfmt --to=iec "$(stat -c %s "$out")")"; done_n=$((done_n+1))
  else
    rm -f "$tmp"; echo "GAGAL kompres $f (file asli dibiarkan)"; fail_n=$((fail_n+1))
  fi
done
echo "Selesai: dikompres $done_n, dilewati $skip_n, gagal $fail_n"
