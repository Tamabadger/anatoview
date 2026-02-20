import { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { Stage, Layer, Path, Group, Rect, Line } from 'react-konva';
import { Box, CircularProgress, Typography } from '@mui/material';
import Konva from 'konva';
import apiClient from '@/api/client';
import { useDissectionStore } from '@/stores/useDissectionStore';
import StructureLabel from './StructureLabel';
import { useEventBatcher } from './useEventBatcher';
import type {
  AnatomicalStructure,
  DissectionMode,
  ParsedSvgStructure,
  SvgViewBox,
  ViewportSize,
} from './types';

// ─── Constants ────────────────────────────────────────────────
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.1;
const CORRECT_COLOR = '#27AE6080';
const INCORRECT_COLOR = '#E74C3C80';
const HOVER_COLOR = '#2E86C140';
const SELECTED_COLOR = '#1B4F7260';

// ─── SVG Parser ───────────────────────────────────────────────

/**
 * Parse an SVG string and extract all elements tagged with
 * `data-structure-id` and `data-system` attributes.
 */
function parseSvgModel(svgText: string): {
  structures: ParsedSvgStructure[];
  viewBox: SvgViewBox;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');

  // Parse viewBox
  const vb = svgEl?.getAttribute('viewBox')?.split(/[\s,]+/).map(Number) ?? [0, 0, 800, 600];
  const viewBox: SvgViewBox = { x: vb[0], y: vb[1], width: vb[2], height: vb[3] };

  const structures: ParsedSvgStructure[] = [];

  // Find all elements with data-structure-id
  const taggedElements = doc.querySelectorAll('[data-structure-id]');

  taggedElements.forEach((el) => {
    const structureId = el.getAttribute('data-structure-id') ?? '';
    const svgElementId = el.getAttribute('id') ?? '';
    const system = el.getAttribute('data-system') ?? 'unknown';
    const transform = el.getAttribute('transform') ?? undefined;

    // Extract path data depending on element type
    let pathData = '';
    const tagName = el.tagName.toLowerCase();

    if (tagName === 'path') {
      pathData = el.getAttribute('d') ?? '';
    } else if (tagName === 'circle') {
      // Convert circle to a path
      const cx = parseFloat(el.getAttribute('cx') ?? '0');
      const cy = parseFloat(el.getAttribute('cy') ?? '0');
      const r = parseFloat(el.getAttribute('r') ?? '0');
      pathData = `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${r * 2},0`;
    } else if (tagName === 'ellipse') {
      const cx = parseFloat(el.getAttribute('cx') ?? '0');
      const cy = parseFloat(el.getAttribute('cy') ?? '0');
      const rx = parseFloat(el.getAttribute('rx') ?? '0');
      const ry = parseFloat(el.getAttribute('ry') ?? '0');
      pathData = `M ${cx - rx},${cy} a ${rx},${ry} 0 1,0 ${rx * 2},0 a ${rx},${ry} 0 1,0 -${rx * 2},0`;
    } else if (tagName === 'rect') {
      const x = parseFloat(el.getAttribute('x') ?? '0');
      const y = parseFloat(el.getAttribute('y') ?? '0');
      const w = parseFloat(el.getAttribute('width') ?? '0');
      const h = parseFloat(el.getAttribute('height') ?? '0');
      pathData = `M ${x},${y} L ${x + w},${y} L ${x + w},${y + h} L ${x},${y + h} Z`;
    } else if (tagName === 'polygon') {
      const points = el.getAttribute('points') ?? '';
      const coords = points.trim().split(/[\s,]+/);
      if (coords.length >= 2) {
        pathData = `M ${coords[0]},${coords[1]}`;
        for (let i = 2; i < coords.length; i += 2) {
          pathData += ` L ${coords[i]},${coords[i + 1]}`;
        }
        pathData += ' Z';
      }
    } else if (tagName === 'g') {
      // For groups, collect child paths
      const childPaths = el.querySelectorAll('path');
      childPaths.forEach((cp) => {
        pathData += (cp.getAttribute('d') ?? '') + ' ';
      });
      pathData = pathData.trim();
    }

    // Extract fill / stroke
    const fill = el.getAttribute('fill') ?? getComputedFill(el) ?? '#CCCCCC';
    const stroke = el.getAttribute('stroke') ?? '#333333';
    const strokeWidth = parseFloat(el.getAttribute('stroke-width') ?? '1');

    // Compute bounds (approximate via bbox if available, or from path)
    const bounds = computeBounds(el, viewBox);

    if (pathData || tagName === 'g') {
      structures.push({
        structureId,
        svgElementId,
        system,
        pathData,
        fill,
        stroke,
        strokeWidth,
        bounds,
        transform,
      });
    }
  });

  return { structures, viewBox };
}

/** Get inherited fill from CSS or parent */
function getComputedFill(el: Element): string | null {
  const style = el.getAttribute('style');
  if (style) {
    const match = style.match(/fill\s*:\s*([^;]+)/);
    if (match) return match[1].trim();
  }
  return null;
}

/** Compute approximate bounding box for an element */
function computeBounds(
  el: Element,
  viewBox: SvgViewBox
): { x: number; y: number; width: number; height: number } {
  // Try to get explicit positioning from the element
  const x = parseFloat(el.getAttribute('x') ?? el.getAttribute('cx') ?? '0');
  const y = parseFloat(el.getAttribute('y') ?? el.getAttribute('cy') ?? '0');
  const width = parseFloat(
    el.getAttribute('width') ??
      (el.getAttribute('rx') ? String(parseFloat(el.getAttribute('rx')!) * 2) : '0') ??
      (el.getAttribute('r') ? String(parseFloat(el.getAttribute('r')!) * 2) : '0')
  );
  const height = parseFloat(
    el.getAttribute('height') ??
      (el.getAttribute('ry') ? String(parseFloat(el.getAttribute('ry')!) * 2) : '0') ??
      (el.getAttribute('r') ? String(parseFloat(el.getAttribute('r')!) * 2) : '0')
  );

  if (width > 0 && height > 0) {
    return { x, y, width, height };
  }

  // Fallback: parse path data to extract crude bounds
  if (el.tagName.toLowerCase() === 'path') {
    const d = el.getAttribute('d') ?? '';
    return pathBounds(d);
  }

  // Default to center of viewBox
  return {
    x: viewBox.x + viewBox.width * 0.25,
    y: viewBox.y + viewBox.height * 0.25,
    width: viewBox.width * 0.5,
    height: viewBox.height * 0.5,
  };
}

/** Parse path d-string to extract min/max coordinates */
function pathBounds(d: string): { x: number; y: number; width: number; height: number } {
  const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
  if (nums.length < 2) return { x: 0, y: 0, width: 100, height: 100 };

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (let i = 0; i < nums.length - 1; i += 2) {
    const px = nums[i];
    const py = nums[i + 1];
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  return {
    x: minX === Infinity ? 0 : minX,
    y: minY === Infinity ? 0 : minY,
    width: maxX - minX || 100,
    height: maxY - minY || 100,
  };
}

// ─── Props ────────────────────────────────────────────────────

interface DissectionViewerProps {
  /** URL to the SVG model (e.g., LocalStack / S3 presigned) */
  modelUrl: string;
  /** Anatomical structures from the API for this model */
  structures: AnatomicalStructure[];
  /** Current dissection mode */
  mode: DissectionMode;
  /** Lab ID */
  labId: string;
  /** Attempt ID for event tracking */
  attemptId: string | null;
  /** Called when student submits an answer in identify/quiz mode */
  onAnswer: (structureId: string, answer: string) => void;
  /** Called when a structure is clicked in explore mode (to show popover) */
  onStructureClick?: (structureId: string, anchorPosition: { x: number; y: number }) => void;
  /** Hidden systems from LayerPanel */
  hiddenSystems?: Set<string>;
}

// ─── Animated Group (smooth fade for layer toggling) ──────────

const LAYER_FADE_DURATION = 0.3; // seconds

/**
 * Konva Group that animates opacity when `visible` changes.
 * Provides a smooth fade-in/fade-out instead of abrupt show/hide.
 */
function AnimatedGroup({
  visible,
  children,
}: {
  visible: boolean;
  children: React.ReactNode;
}) {
  const groupRef = useRef<Konva.Group>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;

    // Skip animation on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      node.opacity(visible ? 1 : 0);
      node.listening(visible);
      return;
    }

    // Animate opacity
    node.to({
      opacity: visible ? 1 : 0,
      duration: LAYER_FADE_DURATION,
      easing: Konva.Easings.EaseInOut,
      onFinish: () => {
        // Disable hit detection when fully hidden
        node.listening(visible);
      },
    });

    // Enable hit detection immediately when showing
    if (visible) {
      node.listening(true);
    }
  }, [visible]);

  return (
    <Group ref={groupRef} opacity={visible ? 1 : 0} listening={visible}>
      {children}
    </Group>
  );
}

// ─── Public handle for imperative zoom-to-structure ───────────

export interface DissectionViewerHandle {
  /** Smoothly pan + zoom to center the given structure on screen */
  focusStructure: (structureId: string) => void;
}

// ─── Component ────────────────────────────────────────────────

/**
 * Main Konva-based SVG dissection canvas.
 *
 * Responsibilities:
 * - Fetches SVG model text from modelUrl
 * - Parses SVG → array of ParsedSvgStructure
 * - Renders structures as Konva Paths
 * - Handles click per mode (explore → popover, identify → answer input, quiz → answer input)
 * - Hover effects with StructureLabels
 * - Zoom via scroll / pinch, pan via drag
 * - Layer visibility via hiddenSystems (with animated fade transitions)
 * - Leader lines connecting labels to structure centers
 * - Batches dissection events to the API
 */
const DissectionViewer = forwardRef<DissectionViewerHandle, DissectionViewerProps>(function DissectionViewer({
  modelUrl,
  structures,
  mode,
  labId: _labId,
  attemptId,
  onAnswer,
  onStructureClick,
  hiddenSystems = new Set(),
}: DissectionViewerProps, ref) {
  // _labId reserved for future use (e.g., loading structure-specific rubrics)
  void _labId;
  // ─── State ──────────────────────────────────────────────────
  const [svgStructures, setSvgStructures] = useState<ParsedSvgStructure[]>([]);
  const [viewBox, setViewBox] = useState<SvgViewBox>({ x: 0, y: 0, width: 800, height: 600 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState<ViewportSize>({ width: 800, height: 600 });

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  // Zustand store
  const zoomLevel = useDissectionStore((s) => s.zoomLevel);
  const panOffset = useDissectionStore((s) => s.panOffset);
  const selectedStructure = useDissectionStore((s) => s.selectedStructure);
  const answeredStructures = useDissectionStore((s) => s.answeredStructures);
  const setZoom = useDissectionStore((s) => s.setZoom);
  const setPan = useDissectionStore((s) => s.setPan);
  const selectStructure = useDissectionStore((s) => s.selectStructure);

  // Event batcher
  const { trackEvent } = useEventBatcher(attemptId);

  // ─── Imperative handle for structure focus/zoom ─────────────
  useImperativeHandle(ref, () => ({
    focusStructure: (structureId: string) => {
      const svgStruct = svgStructures.find((s) => s.structureId === structureId);
      if (!svgStruct) return;

      // Center on the structure with a comfortable zoom level
      const targetZoom = Math.max(2.0, zoomLevel);
      const targetScale = baseScale * targetZoom;

      const centerX = svgStruct.bounds.x + svgStruct.bounds.width / 2;
      const centerY = svgStruct.bounds.y + svgStruct.bounds.height / 2;

      const newPan = {
        x: containerSize.width / 2 - centerX * targetScale,
        y: containerSize.height / 2 - centerY * targetScale,
      };

      setZoom(targetZoom);
      setPan(newPan);
      selectStructure(structureId);

      trackEvent({
        eventType: 'click',
        structureId,
        payload: { source: 'search', zoomLevel: targetZoom },
      });
    },
  }));

  // ─── Build structure lookup ─────────────────────────────────
  const structureMap = useMemo(
    () => new Map(structures.map((s) => [s.id, s])),
    [structures]
  );

  // ─── Fetch and parse SVG ────────────────────────────────────
  useEffect(() => {
    if (!modelUrl) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const resp = await apiClient.get<string>(modelUrl, {
          responseType: 'text',
          // Don't use baseURL for absolute S3 URLs
          ...(modelUrl.startsWith('http') ? { baseURL: '' } : {}),
        });
        if (cancelled) return;

        const { structures: parsed, viewBox: vb } = parseSvgModel(resp.data);
        setSvgStructures(parsed);
        setViewBox(vb);
      } catch (err) {
        if (!cancelled) {
          console.error('[DissectionViewer] Failed to load SVG model:', err);
          setError('Failed to load the anatomical model. Please try refreshing.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [modelUrl]);

  // ─── Resize observer ───────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ─── Compute scale to fit viewBox in container ─────────────
  const baseScale = useMemo(() => {
    const scaleX = containerSize.width / viewBox.width;
    const scaleY = containerSize.height / viewBox.height;
    return Math.min(scaleX, scaleY);
  }, [containerSize, viewBox]);

  const effectiveScale = baseScale * zoomLevel;

  // ─── Handlers ───────────────────────────────────────────────

  /** Zoom via mouse wheel */
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY < 0 ? 1 : -1;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + direction * ZOOM_STEP));

      // Zoom toward pointer position
      const oldScale = baseScale * zoomLevel;
      const newScale = baseScale * newZoom;

      const mousePointTo = {
        x: (pointer.x - panOffset.x) / oldScale,
        y: (pointer.y - panOffset.y) / oldScale,
      };

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };

      setZoom(newZoom);
      setPan(newPos);

      trackEvent({ eventType: 'zoom', payload: { zoomLevel: newZoom } });
    },
    [zoomLevel, panOffset, baseScale, setZoom, setPan, trackEvent]
  );

  /** Pan via drag on stage */
  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      // Only handle stage drag, not shape drag
      if (e.target !== stageRef.current) return;
      const stage = stageRef.current;
      if (!stage) return;
      setPan({ x: stage.x(), y: stage.y() });
    },
    [setPan]
  );

  /** Handle structure click based on mode */
  const handleStructureClick = useCallback(
    (structureId: string) => {
      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();

      selectStructure(structureId);

      trackEvent({
        eventType: 'click',
        structureId,
        payload: {
          mode,
          x: pointer?.x ?? 0,
          y: pointer?.y ?? 0,
        },
      });

      // In identify/quiz mode, delegate to the onAnswer callback flow
      // (the AnswerInput component handles the actual answer submission)
      void onAnswer;

      if (mode === 'explore' && onStructureClick && pointer) {
        // Convert stage coords to screen coords for popover positioning
        const containerRect = containerRef.current?.getBoundingClientRect();
        onStructureClick(structureId, {
          x: (containerRect?.left ?? 0) + pointer.x,
          y: (containerRect?.top ?? 0) + pointer.y,
        });
      }
      // For identify / quiz mode, the parent handles showing AnswerInput
      // based on the selectedStructure from the store
    },
    [mode, selectStructure, onStructureClick, trackEvent]
  );

  /** Handle hover over structure */
  const handleStructureHover = useCallback(
    (structureId: string | null) => {
      setHoveredId(structureId);
      if (structureId) {
        trackEvent({
          eventType: 'hover',
          structureId,
        });
      }
    },
    [trackEvent]
  );

  // ─── Determine fill color for each structure ────────────────
  const getStructureFill = useCallback(
    (svgStruct: ParsedSvgStructure): string => {
      const answer = answeredStructures.get(svgStruct.structureId);
      const isHovered = hoveredId === svgStruct.structureId;
      const isSelected = selectedStructure === svgStruct.structureId;

      if (answer?.isCorrect === true) return CORRECT_COLOR;
      if (answer?.isCorrect === false) return INCORRECT_COLOR;
      if (isSelected) return SELECTED_COLOR;
      if (isHovered) return HOVER_COLOR;

      return svgStruct.fill;
    },
    [hoveredId, selectedStructure, answeredStructures]
  );

  // ─── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <CircularProgress size={48} />
        <Typography variant="body2" color="text.secondary">
          Loading anatomical model...
        </Typography>
      </Box>
    );
  }

  // ─── Error state ────────────────────────────────────────────
  if (error) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Typography variant="body1" color="error">
          {error}
        </Typography>
      </Box>
    );
  }

  // ─── Group structures by system for layer toggling ──────────
  const systemGroups = new Map<string, ParsedSvgStructure[]>();
  svgStructures.forEach((s) => {
    const list = systemGroups.get(s.system) ?? [];
    list.push(s);
    systemGroups.set(s.system, list);
  });

  // ─── Render ─────────────────────────────────────────────────
  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'grab',
        '&:active': { cursor: 'grabbing' },
        backgroundColor: '#F8F9FA',
      }}
    >
      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        scaleX={effectiveScale}
        scaleY={effectiveScale}
        x={panOffset.x}
        y={panOffset.y}
        draggable
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
      >
        {/* Background layer — clickable for deselect */}
        <Layer>
          <Rect
            x={viewBox.x}
            y={viewBox.y}
            width={viewBox.width}
            height={viewBox.height}
            fill="transparent"
            onClick={() => selectStructure(null)}
            onTap={() => selectStructure(null)}
          />
        </Layer>

        {/* Render each organ-system as an AnimatedGroup (smooth fade on toggle) */}
        <Layer>
          {Array.from(systemGroups.entries()).map(([system, sysStructures]) => {
            const isHidden = hiddenSystems.has(system);

            return (
              <AnimatedGroup key={system} visible={!isHidden}>
                {sysStructures.map((svgStruct) => (
                  <Path
                    key={svgStruct.structureId}
                    data={svgStruct.pathData}
                    fill={getStructureFill(svgStruct)}
                    stroke={
                      selectedStructure === svgStruct.structureId
                        ? '#1B4F72'
                        : hoveredId === svgStruct.structureId
                          ? '#2E86C1'
                          : svgStruct.stroke
                    }
                    strokeWidth={
                      selectedStructure === svgStruct.structureId ||
                      hoveredId === svgStruct.structureId
                        ? svgStruct.strokeWidth * 2
                        : svgStruct.strokeWidth
                    }
                    hitStrokeWidth={8}
                    onClick={() => handleStructureClick(svgStruct.structureId)}
                    onTap={() => handleStructureClick(svgStruct.structureId)}
                    onMouseEnter={() => {
                      handleStructureHover(svgStruct.structureId);
                      const stage = stageRef.current;
                      if (stage) {
                        stage.container().style.cursor = 'pointer';
                      }
                    }}
                    onMouseLeave={() => {
                      handleStructureHover(null);
                      const stage = stageRef.current;
                      if (stage) {
                        stage.container().style.cursor = 'grab';
                      }
                    }}
                  />
                ))}
              </AnimatedGroup>
            );
          })}
        </Layer>

        {/* ─── Leader lines + Labels layer ─────────────────────── */}
        <Layer listening={false}>
          {svgStructures.map((svgStruct) => {
            if (hiddenSystems.has(svgStruct.system)) return null;

            const fullStructure = structureMap.get(svgStruct.structureId);
            if (!fullStructure) return null;

            const answer = answeredStructures.get(svgStruct.structureId);
            const isHovered = hoveredId === svgStruct.structureId;
            const isSelected = selectedStructure === svgStruct.structureId;

            // Label position: center-top of structure bounds
            const labelX = svgStruct.bounds.x + svgStruct.bounds.width / 2;
            const labelY = svgStruct.bounds.y - 32;

            // Structure center (for leader line endpoint)
            const structCenterX = svgStruct.bounds.x + svgStruct.bounds.width / 2;
            const structCenterY = svgStruct.bounds.y + svgStruct.bounds.height / 2;

            // Determine visibility based on mode
            let showLabel = false;
            if (mode === 'explore') {
              showLabel = isHovered || isSelected;
            } else if (mode === 'identify') {
              showLabel = isHovered || isSelected || !!answer;
            } else if (mode === 'quiz') {
              showLabel = answer?.isCorrect === true;
            }

            return (
              <Group key={svgStruct.structureId}>
                {/* Leader line from label to structure center */}
                {showLabel && (
                  <Line
                    points={[labelX, labelY + 10, structCenterX, structCenterY]}
                    stroke={isSelected ? '#1B4F72' : '#607D8B'}
                    strokeWidth={0.8}
                    dash={[4, 3]}
                    opacity={0.6}
                    listening={false}
                  />
                )}
                <StructureLabel
                  name={fullStructure.name}
                  x={labelX}
                  y={svgStruct.bounds.y}
                  isCorrect={answer?.isCorrect}
                  isSelected={isSelected}
                  mode={mode}
                  visible={showLabel}
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>

      {/* Zoom level indicator overlay */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          backgroundColor: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(4px)',
          borderRadius: 1,
          px: 1,
          py: 0.5,
          pointerEvents: 'none',
        }}
      >
        <Typography variant="caption" color="text.secondary" fontFamily="monospace">
          {Math.round(zoomLevel * 100)}%
        </Typography>
      </Box>
    </Box>
  );
});

export default DissectionViewer;

// ─── Re-export utilities for parent components ────────────────
export { type DissectionViewerProps };
