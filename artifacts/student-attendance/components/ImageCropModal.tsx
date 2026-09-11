/**
 * ImageCropModal – web-only square-crop overlay.
 *
 * On iOS / Android, expo-image-picker's `allowsEditing` already shows the
 * system crop UI, so this component renders nothing on those platforms.
 *
 * On web, expo-image-picker ignores `allowsEditing`, so this modal fills
 * the gap: it accepts a raw image URI, lets the user pan and zoom a 1:1
 * crop window over the image, and resolves a square data-URL via <canvas>.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  /** Raw image URI returned by expo-image-picker (blob: or data: on web). */
  sourceUri: string | null;
  /** Called with the cropped square data-URL, or null if cancelled. */
  onDone: (dataUrl: string | null) => void;
}

// ─── Web implementation ───────────────────────────────────────────────────────

function WebCropModal({ sourceUri, onDone }: Props) {
  const colors = useColors();

  // Natural image dimensions
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  // Container (preview) dimensions
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  // Crop square side (in preview-pixels)
  const [cropSide, setCropSide] = useState(0);
  // Crop square top-left offset (in preview-pixels)
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // Scale factor: preview-px → natural-px
  const scaleRef = useRef(1);

  const [loading, setLoading] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Drag state
  const dragRef = useRef<{ startX: number; startY: number; startOffX: number; startOffY: number } | null>(null);
  // Pinch-to-zoom state
  const pinchRef = useRef<{ startDist: number; startCrop: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Load image & measure natural size ──────────────────────────────────────
  useEffect(() => {
    if (!sourceUri) return;
    setImgLoaded(false);
    const img = new Image();
    img.onload = () => {
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setImgLoaded(true);
    };
    img.src = sourceUri;
  }, [sourceUri]);

  // ── Recalculate layout whenever container or image changes ─────────────────
  const recalc = useCallback(
    (bw: number, bh: number, iw: number, ih: number) => {
      if (!bw || !bh || !iw || !ih) return;
      const scale = Math.min(bw / iw, bh / ih);
      scaleRef.current = scale;
      const previewW = iw * scale;
      const previewH = ih * scale;
      const side = Math.floor(Math.min(previewW, previewH) * 0.8);
      const ox = Math.floor((previewW - side) / 2);
      const oy = Math.floor((previewH - side) / 2);
      setCropSide(side);
      setOffset({ x: ox, y: oy });
    },
    []
  );

  useEffect(() => {
    recalc(boxSize.w, boxSize.h, imgSize.w, imgSize.h);
  }, [boxSize, imgSize, recalc]);

  // ── Clamp helpers ──────────────────────────────────────────────────────────
  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const clampedOffset = useCallback(
    (x: number, y: number, side: number) => {
      const scale = scaleRef.current;
      const maxX = imgSize.w * scale - side;
      const maxY = imgSize.h * scale - side;
      return { x: clamp(x, 0, Math.max(0, maxX)), y: clamp(y, 0, Math.max(0, maxY)) };
    },
    [imgSize]
  );

  // ── Pointer events for dragging ─────────────────────────────────────────────
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { startX: e.clientX, startY: e.clientY, startOffX: offset.x, startOffY: offset.y };
    },
    [offset]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setOffset(clampedOffset(dragRef.current.startOffX + dx, dragRef.current.startOffY + dy, cropSide));
    },
    [cropSide, clampedOffset]
  );

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  // ── Touch pinch-to-zoom ─────────────────────────────────────────────────────
  const getTouchDist = (t: React.TouchList) => {
    if (t.length < 2) return 0;
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { startDist: getTouchDist(e.touches), startCrop: cropSide };
        dragRef.current = null;
      } else {
        pinchRef.current = null;
        const t = e.touches[0];
        dragRef.current = { startX: t.clientX, startY: t.clientY, startOffX: offset.x, startOffY: offset.y };
      }
    },
    [cropSide, offset]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (pinchRef.current && e.touches.length === 2) {
        const dist = getTouchDist(e.touches);
        const ratio = dist / pinchRef.current.startDist;
        const scale = scaleRef.current;
        const maxSide = Math.min(imgSize.w * scale, imgSize.h * scale);
        const newSide = clamp(Math.round(pinchRef.current.startCrop * ratio), 40, maxSide);
        setCropSide(newSide);
        setOffset((prev) => clampedOffset(prev.x, prev.y, newSide));
      } else if (dragRef.current && e.touches.length === 1) {
        const t = e.touches[0];
        const dx = t.clientX - dragRef.current.startX;
        const dy = t.clientY - dragRef.current.startY;
        setOffset(clampedOffset(dragRef.current.startOffX + dx, dragRef.current.startOffY + dy, cropSide));
      }
    },
    [imgSize, cropSide, clampedOffset]
  );

  const onTouchEnd = useCallback(() => {
    dragRef.current = null;
    pinchRef.current = null;
  }, []);

  // ── Mouse-wheel to resize crop ─────────────────────────────────────────────
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const scale = scaleRef.current;
      const maxSide = Math.min(imgSize.w * scale, imgSize.h * scale);
      const delta = -e.deltaY * 0.5;
      const newSide = clamp(cropSide + delta, 40, maxSide);
      setCropSide(newSide);
      setOffset((prev) => clampedOffset(prev.x, prev.y, newSide));
    },
    [imgSize, cropSide, clampedOffset]
  );

  // ── Commit crop via canvas ─────────────────────────────────────────────────
  const handleCrop = useCallback(async () => {
    setLoading(true);
    try {
      const canvas = canvasRef.current!;
      const OUTPUT_SIZE = 512;
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d')!;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = rej;
        img.src = sourceUri!;
      });

      const scale = scaleRef.current;
      const sx = Math.round(offset.x / scale);
      const sy = Math.round(offset.y / scale);
      const sw = Math.round(cropSide / scale);

      ctx.drawImage(img, sx, sy, sw, sw, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      onDone(dataUrl);
    } catch {
      onDone(null);
    } finally {
      setLoading(false);
    }
  }, [sourceUri, offset, cropSide, onDone]);

  if (!sourceUri) return null;

  const scale = scaleRef.current;
  const previewW = imgSize.w * scale || boxSize.w;
  const previewH = imgSize.h * scale || boxSize.h;

  return (
    <Modal visible={!!sourceUri} transparent animationType="fade" statusBarTranslucent>
      <View style={[s.overlay, { backgroundColor: 'rgba(0,0,0,0.92)' }]}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={[s.header, { borderBottomColor: `${colors.border}44` }]}>
          <Pressable onPress={() => onDone(null)} style={s.cancelBtn} accessibilityLabel="Cancel crop">
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </Pressable>
          <Text style={[s.headerTitle, { color: '#fff' }]}>Crop Photo</Text>
          <Pressable
            onPress={handleCrop}
            disabled={!imgLoaded || loading}
            style={[s.doneBtn, { backgroundColor: colors.primary, opacity: !imgLoaded || loading ? 0.55 : 1 }]}
            accessibilityLabel="Use cropped photo"
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Text style={[s.doneBtnText, { color: colors.primaryForeground }]}>Use Photo</Text>
            )}
          </Pressable>
        </View>

        {/* ── Hint ───────────────────────────────────────────────────────── */}
        <Text style={s.hint}>Drag · Scroll or pinch to resize</Text>

        {/* ── Crop area ──────────────────────────────────────────────────── */}
        <View
          style={s.cropBox}
          onLayout={(e) => setBoxSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          {imgLoaded ? (
            // @ts-ignore – web-only <div> inside RN tree
            <div
              style={{
                position: 'relative',
                width: previewW,
                height: previewH,
                cursor: 'grab',
                userSelect: 'none',
                touchAction: 'none',
              }}
              onPointerDown={onPointerDown as any}
              onPointerMove={onPointerMove as any}
              onPointerUp={onPointerUp as any}
              onPointerCancel={onPointerUp as any}
              onTouchStart={onTouchStart as any}
              onTouchMove={onTouchMove as any}
              onTouchEnd={onTouchEnd as any}
              onWheel={onWheel as any}
            >
              {/* Image */}
              {/* @ts-ignore */}
              <img
                src={sourceUri}
                draggable={false}
                style={{ display: 'block', width: previewW, height: previewH, pointerEvents: 'none', userSelect: 'none' }}
                alt="preview"
              />

              {/* Dark masks around crop */}
              {/* @ts-ignore */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: offset.y, background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
              {/* @ts-ignore */}
              <div style={{ position: 'absolute', left: 0, right: 0, top: offset.y + cropSide, bottom: 0, background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
              {/* @ts-ignore */}
              <div style={{ position: 'absolute', left: 0, width: offset.x, top: offset.y, height: cropSide, background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
              {/* @ts-ignore */}
              <div style={{ position: 'absolute', left: offset.x + cropSide, right: 0, top: offset.y, height: cropSide, background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }} />

              {/* Circular crop border */}
              {/* @ts-ignore */}
              <div
                style={{
                  position: 'absolute',
                  left: offset.x,
                  top: offset.y,
                  width: cropSide,
                  height: cropSide,
                  border: '2px solid rgba(255,255,255,0.85)',
                  borderRadius: '50%',
                  boxSizing: 'border-box',
                  pointerEvents: 'none',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.15)',
                }}
              />

              {/* Rule-of-thirds grid (clipped to circle) */}
              {/* @ts-ignore */}
              <div
                style={{
                  position: 'absolute',
                  left: offset.x,
                  top: offset.y,
                  width: cropSide,
                  height: cropSide,
                  pointerEvents: 'none',
                  borderRadius: '50%',
                  overflow: 'hidden',
                }}
              >
                {/* @ts-ignore */}
                <div style={{ position: 'absolute', top: '33.3%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.22)' }} />
                {/* @ts-ignore */}
                <div style={{ position: 'absolute', top: '66.6%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.22)' }} />
                {/* @ts-ignore */}
                <div style={{ position: 'absolute', left: '33.3%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.22)' }} />
                {/* @ts-ignore */}
                <div style={{ position: 'absolute', left: '66.6%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.22)' }} />
              </div>
            </div>
          ) : (
            <ActivityIndicator color={colors.primary} size="large" />
          )}
        </View>

        {/* Hidden canvas for rendering the final crop */}
        {/* @ts-ignore */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </View>
    </Modal>
  );
}

// ─── Stub for native ──────────────────────────────────────────────────────────

function NativeCropModal(_: Props) {
  // On native, expo-image-picker's `allowsEditing: true` + `aspect: [1, 1]`
  // already provides a native crop UI. Nothing to do here.
  return null;
}

// ─── Public export ────────────────────────────────────────────────────────────

export const ImageCropModal = Platform.OS === 'web' ? WebCropModal : NativeCropModal;

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 30,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  cancelBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  doneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 90,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  cropBox: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
